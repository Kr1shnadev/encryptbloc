'use strict';

const { Contract } = require('fabric-contract-api');

class CIDStoreContract extends Contract {

    // Initialize the chaincode
    async InitLedger(ctx) {
        console.info('============= START : Initialize Ledger ===========');
        console.info('============= END : Initialize Ledger ===========');
    }

    // Create composite key for storing records
    createKey(owner, cid) {
        return `cid_${owner}_${cid}`;
    }

    // StoreCID stores a new CID record on the blockchain
    async StoreCID(ctx, cid, fileName) {
        console.info('============= START : Store CID ===========');

        // Get the ID of the submitting client
        const clientID = ctx.clientIdentity.getID();

        const record = {
            cid: cid,
            owner: clientID,
            timestamp: new Date().toISOString(),
            fileName: fileName,
            docType: 'cidRecord' // for query purposes
        };

        // Create composite key
        const key = this.createKey(clientID, cid);

        // Store the record
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));
        console.info('============= END : Store CID ===========');
        return JSON.stringify(record);
    }

    // GetCID retrieves a CID record by its ID
    async GetCID(ctx, cid) {
        console.info('============= START : Get CID ===========');
        
        const clientID = ctx.clientIdentity.getID();
        const key = this.createKey(clientID, cid);
        
        const recordAsBytes = await ctx.stub.getState(key);
        if (!recordAsBytes || recordAsBytes.length === 0) {
            throw new Error(`The CID ${cid} does not exist`);
        }

        console.info('============= END : Get CID ===========');
        return recordAsBytes.toString();
    }

    // GetAllCIDs returns all CIDs stored by the current user
    async GetAllCIDs(ctx) {
        console.info('============= START : Get All CIDs ===========');
        
        const clientID = ctx.clientIdentity.getID();
        
        // Get all records for the owner using composite key
        const startKey = this.createKey(clientID, '');
        const endKey = this.createKey(clientID, '\uffff');

        const iterator = await ctx.stub.getStateByRange(startKey, endKey);
        const records = [];

        while (true) {
            const result = await iterator.next();

            if (result.value && result.value.value.toString()) {
                let record;
                try {
                    record = JSON.parse(result.value.value.toString('utf8'));
                } catch (err) {
                    console.log(err);
                    record = result.value.value.toString('utf8');
                }
                records.push(record);
            }

            if (result.done) {
                await iterator.close();
                console.info('============= END : Get All CIDs ===========');
                return JSON.stringify(records);
            }
        }
    }

    // QueryCIDsByOwner allows querying CIDs by owner using rich queries
    async QueryCIDsByOwner(ctx, owner) {
        console.info('============= START : Query CIDs by Owner ===========');
        
        let queryString = {
            selector: {
                docType: 'cidRecord',
                owner: owner
            }
        };

        let iterator = await ctx.stub.getQueryResult(JSON.stringify(queryString));
        let records = [];

        while (true) {
            const result = await iterator.next();

            if (result.value && result.value.value.toString()) {
                let record;
                try {
                    record = JSON.parse(result.value.value.toString('utf8'));
                    records.push(record);
                } catch (err) {
                    console.log(err);
                }
            }

            if (result.done) {
                await iterator.close();
                console.info('============= END : Query CIDs by Owner ===========');
                return JSON.stringify(records);
            }
        }
    }
}

module.exports = CIDStoreContract; 