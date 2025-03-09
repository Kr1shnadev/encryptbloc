const express = require('express');
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = 3003;

// Use CORS and JSON middleware
app.use(cors());
app.use(express.json());

// Connection configuration
const channelName = 'mychannel';
const chaincodeName = 'basic';
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'appUser';

// Add a test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'Backend is running!' });
});

// Connect to the Fabric network
async function connectToNetwork() {
    try {
        // Load the network configuration
        const ccpPath = path.resolve(__dirname, 'connection-org1.json');        if (!fs.existsSync(ccpPath)) {
            throw new Error(`Config file not found at ${ccpPath}`);
        }
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new file system based wallet for managing identities
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check if user identity exists in wallet
        const identity = await wallet.get(org1UserId);
        if (!identity) {
            console.log(`An identity for the user ${org1UserId} does not exist in the wallet`);
            return null;
        }

        // Create a new gateway for connecting to the peer node
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: org1UserId,
            discovery: { enabled: true, asLocalhost: true }
        });

        // Get the network (channel) our contract is deployed to
        const network = await gateway.getNetwork(channelName);
        // Get the contract from the network
        const contract = network.getContract(chaincodeName);

        return { gateway, contract };
    } catch (error) {
        console.error(`Failed to connect to the network: ${error}`);
        throw error;
    }
}

// Store CID endpoint
app.post('/api/store-cid', async (req, res) => {
    try {
        console.log('Received store-cid request:', req.body);
        const { cid, fileName } = req.body;
        
        if (!cid || !fileName) {
            throw new Error('CID and fileName are required');
        }

        const { contract, gateway } = await connectToNetwork();
        if (!contract) {
            throw new Error('Failed to connect to Fabric network');
        }

        // Submit transaction
        const result = await contract.submitTransaction('StoreCID', cid, fileName);
        console.log('Transaction submitted successfully');
        
        // Disconnect from the gateway
        await gateway.disconnect();

        res.json({ 
            success: true, 
            message: 'CID stored successfully',
            result: JSON.parse(result.toString())
        });
    } catch (error) {
        console.error(`Failed to store CID: ${error}`);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get CID endpoint
app.get('/api/get-cid/:cid', async (req, res) => {
    try {
        const { cid } = req.params;
        
        const { contract, gateway } = await connectToNetwork();
        if (!contract) {
            throw new Error('Failed to connect to Fabric network');
        }

        // Evaluate transaction
        const result = await contract.evaluateTransaction('GetCID', cid);
        
        // Disconnect from the gateway
        await gateway.disconnect();

        res.json({ success: true, record: JSON.parse(result.toString()) });
    } catch (error) {
        console.error(`Failed to get CID: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all CIDs endpoint
app.get('/api/get-all-cids', async (req, res) => {
    try {
        console.log('Received get-all-cids request');
        const { contract, gateway } = await connectToNetwork();
        if (!contract) {
            throw new Error('Failed to connect to Fabric network');
        }

        // Evaluate transaction
        const result = await contract.evaluateTransaction('GetAllCIDs');
        console.log('Successfully retrieved all CIDs');
        
        // Disconnect from the gateway
        await gateway.disconnect();

        res.json({ 
            success: true, 
            records: JSON.parse(result.toString())
        });
    } catch (error) {
        console.error(`Failed to get CIDs: ${error}`);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log(`Test the connection at http://localhost:${port}/test`);
}); 