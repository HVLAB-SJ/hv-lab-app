#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MongoDB Data Migration Script
Migrates data from local MongoDB to Railway MongoDB
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from pymongo import MongoClient

# Source (Local MongoDB)
LOCAL_URI = "mongodb://localhost:27017"
LOCAL_DB_NAME = "interior-management"

# Target (Railway MongoDB)
RAILWAY_URI = "mongodb://mongo:lPAuuiDaaIpckSmyCEaEBXPWArmAHtZn@yamanote.proxy.rlwy.net:24465"
RAILWAY_DB_NAME = "railway"

def migrate_collection(source_db, target_db, collection_name):
    """Migrate a single collection"""
    print(f"\n📦 Migrating collection: {collection_name}")

    source_collection = source_db[collection_name]
    target_collection = target_db[collection_name]

    # Get all documents from source
    documents = list(source_collection.find())

    if not documents:
        print(f"   ⚠️  No documents found in {collection_name}")
        return 0

    # Clear target collection first
    result = target_collection.delete_many({})
    print(f"   🗑️  Cleared {result.deleted_count} existing documents")

    # Insert documents into target
    if documents:
        target_collection.insert_many(documents)
        print(f"   ✅ Migrated {len(documents)} documents")

    return len(documents)

def main():
    try:
        print("🚀 Starting MongoDB Data Migration")
        print("=" * 50)

        # Connect to source
        print("\n📡 Connecting to local MongoDB...")
        source_client = MongoClient(LOCAL_URI)
        source_db = source_client[LOCAL_DB_NAME]
        print("   ✅ Connected to local MongoDB")

        # Connect to target
        print("\n📡 Connecting to Railway MongoDB...")
        target_client = MongoClient(RAILWAY_URI)
        target_db = target_client[RAILWAY_DB_NAME]
        print("   ✅ Connected to Railway MongoDB")

        # Get all collections from source
        collections = source_db.list_collection_names()
        print(f"\n📋 Found {len(collections)} collections to migrate:")
        for col in collections:
            print(f"   - {col}")

        # Migrate each collection
        total_docs = 0
        for collection_name in collections:
            count = migrate_collection(source_db, target_db, collection_name)
            total_docs += count

        print("\n" + "=" * 50)
        print(f"✨ Migration completed successfully!")
        print(f"📊 Total documents migrated: {total_docs}")

        # Close connections
        source_client.close()
        target_client.close()

    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
