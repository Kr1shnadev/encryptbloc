package main

import (
    "encoding/json"
    "fmt"
    "time"

    "github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for managing CIDs
type SmartContract struct {
    contractapi.Contract
}

// CIDRecord represents a CID entry with metadata
type CIDRecord struct {
    CID       string    `json:"cid"`
    Owner     string    `json:"owner"`
    Timestamp time.Time `json:"timestamp"`
    FileName  string    `json:"fileName"`
}

// StoreCID stores a new CID record on the blockchain
func (s *SmartContract) StoreCID(ctx contractapi.TransactionContextInterface, cid string, fileName string) error {
    // Get the ID of the submitting client
    owner, err := ctx.GetClientIdentity().GetID()
    if err != nil {
        return fmt.Errorf("failed to get client identity: %v", err)
    }

    record := CIDRecord{
        CID:       cid,
        Owner:     owner,
        Timestamp: time.Now(),
        FileName:  fileName,
    }

    recordJSON, err := json.Marshal(record)
    if err != nil {
        return err
    }

    // Store the CID record using composite key of owner + cid
    key := createKey(owner, cid)
    return ctx.GetStub().PutState(key, recordJSON)
}

// GetCID retrieves a CID record by its ID
func (s *SmartContract) GetCID(ctx contractapi.TransactionContextInterface, cid string) (*CIDRecord, error) {
    owner, err := ctx.GetClientIdentity().GetID()
    if err != nil {
        return nil, fmt.Errorf("failed to get client identity: %v", err)
    }

    key := createKey(owner, cid)
    recordJSON, err := ctx.GetStub().GetState(key)
    if err != nil {
        return nil, fmt.Errorf("failed to read from world state: %v", err)
    }
    if recordJSON == nil {
        return nil, fmt.Errorf("the CID %s does not exist", cid)
    }

    var record CIDRecord
    err = json.Unmarshal(recordJSON, &record)
    if err != nil {
        return nil, err
    }

    return &record, nil
}

// GetAllCIDs returns all CIDs stored by the current user
func (s *SmartContract) GetAllCIDs(ctx contractapi.TransactionContextInterface) ([]*CIDRecord, error) {
    owner, err := ctx.GetClientIdentity().GetID()
    if err != nil {
        return nil, fmt.Errorf("failed to get client identity: %v", err)
    }

    // Get all records for the owner using composite key
    startKey := createKey(owner, "")
    endKey := createKey(owner, "\xff")

    resultsIterator, err := ctx.GetStub().GetStateByRange(startKey, endKey)
    if err != nil {
        return nil, err
    }
    defer resultsIterator.Close()

    var records []*CIDRecord
    for resultsIterator.HasNext() {
        queryResponse, err := resultsIterator.Next()
        if err != nil {
            return nil, err
        }

        var record CIDRecord
        err = json.Unmarshal(queryResponse.Value, &record)
        if err != nil {
            return nil, err
        }
        records = append(records, &record)
    }

    return records, nil
}

// Helper function to create composite keys
func createKey(owner string, cid string) string {
    return fmt.Sprintf("cid_%s_%s", owner, cid)
}

func main() {
    chaincode, err := contractapi.NewChaincode(&SmartContract{})
    if err != nil {
        fmt.Printf("Error creating CID store chaincode: %s", err.Error())
        return
    }

    if err := chaincode.Start(); err != nil {
        fmt.Printf("Error starting CID store chaincode: %s", err.Error())
    }
} 