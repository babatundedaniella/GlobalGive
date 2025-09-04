# 🌍 GlobalGive: Blockchain Marketplace for Surplus Aid Trading

Welcome to GlobalGive, a transformative platform that connects NGOs and aid organizations to redistribute surplus resources efficiently! Built on the Stacks blockchain using Clarity smart contracts, this marketplace ensures transparent, secure, and tamper-proof trading of unused aid items like food, medical supplies, clothing, and equipment. By leveraging blockchain, we solve real-world problems such as resource wastage, lack of trust in redistribution, and inefficiencies in global aid logistics.

## ✨ Features

🔗 Transparent listing and trading of surplus aid resources  
💼 NGO registration and verification for trusted participants  
💰 Token-based payments using a custom fungible token (e.g., AID tokens)  
📈 Reputation system to build trust among traders  
🔒 Escrow mechanisms for secure transactions  
🛡️ Governance tools for community-driven updates  
📊 Analytics and reporting for aid impact tracking  
🚫 Fraud prevention through immutable records  
🔄 Auction and direct trade options for flexibility  
🌐 Integration with off-chain logistics for real-world delivery confirmation  

## 🛠 How It Works

**For NGOs with Surplus Resources**  
- Register your organization on the platform.  
- List surplus items (e.g., "1000 units of canned food") with details like quantity, expiration date, and location.  
- Set a price in AID tokens or opt for auction/donation.  
- Once a match is found, escrow holds the tokens until delivery is confirmed.  

**For NGOs in Need**  
- Browse listings or search for specific resources.  
- Place bids, make offers, or request direct trades.  
- Complete payment via AID tokens and rate the transaction post-delivery.  

**For Verifiers and Donors**  
- View transaction histories and reputation scores.  
- Participate in governance votes to improve the platform.  
- Donate AID tokens to subsidize trades for underfunded NGOs.  

Transactions are powered by Clarity smart contracts on Stacks, ensuring Bitcoin-level security without high fees. Off-chain oracles can integrate for delivery verification.

## 📜 Smart Contracts Overview

This project involves 8 Clarity smart contracts to handle various aspects of the marketplace securely and efficiently:

1. **NGORegistry.clar**: Manages NGO registration and verification.  
   - Registers NGOs with unique IDs and verified credentials.  
   - Stores metadata (e.g., name, location, contact).  
   - Allows updates to NGO profiles and verification status.  

2. **AidToken.clar**: Implements a fungible token (AID) for transactions.  
   - Manages token minting, transfers, and burns.  
   - Enforces supply limits and access controls for minting.  

3. **ResourceListing.clar**: Handles creation and management of surplus resource listings.  
   - Allows NGOs to list items with details (e.g., type, quantity, location).  
   - Supports listing updates and cancellations.  

4. **Escrow.clar**: Facilitates secure transactions via escrow.  
   - Locks AID tokens during trades until delivery is confirmed.  
   - Releases tokens to sellers or refunds buyers based on conditions.  

5. **ReputationSystem.clar**: Tracks and updates NGO reputation scores.  
   - Records ratings from completed transactions.  
   - Calculates trust scores based on trade history and feedback.  

6. **AuctionHouse.clar**: Manages auctions for surplus resources.  
   - Supports bidding with AID tokens.  
   - Automatically finalizes auctions and transfers funds via escrow.  

7. **Governance.clar**: Enables community-driven platform updates.  
   - Allows verified NGOs to propose and vote on changes (e.g., fee structures).  
   - Implements time-locked governance decisions.  

8. **Analytics.clar**: Provides data on platform usage and impact.  
   - Tracks trade volumes, popular resources, and NGO activity.  
   - Generates reports for transparency and donor insights.