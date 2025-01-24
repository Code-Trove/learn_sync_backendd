import { Pinecone } from "@pinecone-database/pinecone";

// Initialize Pinecone client
const client = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY as string, // API key from environment variables
  // Pinecone environment from environment variables
});

// Initialize the Pinecone client with your API key and environment
export async function initPinecone() {
  try {
    // Create the index (if not already created)
    const indexName = "quickstart"; // Replace with your desired index name

    const createIndexResponse = await client.createIndex({
      name: indexName,
      dimension: 2, // Replace with your vector dimension (e.g., 2-dimensional)
      metric: "cosine", // The metric to be used, cosine in this case
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });
    console.log("Index created:", createIndexResponse);

    // Access the index after creation
    const index = client.Index(indexName);

    // Define sample vectors to upsert
    const titleEmbedding = [0.12, 0.56]; // Example 2D vector for title
    const descriptionEmbedding = [0.23, 0.87]; // Example 2D vector for description

    // Upsert vectors into the Pinecone index
    const upsertResponse = await index.upsert([
      {
        id: "unique-id-1",
        values: titleEmbedding,
        metadata: { type: "TEXT", title: "Example Title" },
      },
      {
        id: "unique-id-2",
        values: descriptionEmbedding,
        metadata: { type: "TEXT", description: "Example Description" },
      },
    ]);
    console.log("Vectors upserted:", upsertResponse);

    // Query the Pinecone index
    const queryVector = [0.1, 0.5]; // Example query vector to compare against
    const queryResults = await index.query({
      vector: queryVector,
      topK: 5,
      includeMetadata: true,
    });
    console.log("Query results:", queryResults);
  } catch (error) {
    console.error("Error initializing Pinecone:", error);
  }
}

// Run the function
initPinecone();
