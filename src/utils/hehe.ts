export const searchContent = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== "string" || query.trim() === "") {
      return res.status(400).json({
        message: "Invalid search query",
        success: false,
      });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Unauthorized: User not authenticated",
        success: false,
      });
    }

    const userId = req.user.id;

    const contents = await prisma.content.findMany({
      where: {
        userId,
        type: "TEXT",
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { extractedText: { contains: query, mode: "insensitive" } },
          { author: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        topics: true,
        summaries: true,
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (contents.length === 0) {
      return res.status(404).json({
        message: "No content found matching the query.",
        success: false,
      });
    }

    console.log("Search results:", contents);

    return res.status(200).json({
      message: "Search results retrieved successfully.",
      data: contents,
      success: true,
    });
  } catch (error: any) {
    console.error("Error during search:", error);
    return res.status(500).json({
      message: "Internal server error",
      success: false,
      error: error.message,
    });
  }
};

export const searchContent = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { query } = req.query;

    // Validate the search query
    if (!query || typeof query !== "string" || query.trim() === "") {
      res.status(400).json({
        message: "Invalid search query",
        success: false,
      });
      return;
    }

    const user = req.user as User;
    const userId = user.id;

    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);

    // Validate the generated embedding
    if (
      !Array.isArray(queryEmbedding) ||
      queryEmbedding.some((val) => isNaN(val))
    ) {
      console.error("Invalid embedding:", queryEmbedding);
      res.status(500).json({
        message: "Error generating embedding for the search query.",
        success: false,
      });
      return;
    }

    // Convert embedding to a safe SQL-compatible format
    const embeddingString = queryEmbedding.join(",");

    // Perform a raw SQL query to find relevant content
    const contents = await prisma.$queryRawUnsafe<SearchResult[]>(
      `
      SELECT 
        id, 
        title, 
        "extractedText", -- Use double quotes to preserve case sensitivity
        author,
        cosine_similarity("embedding", ARRAY[${embeddingString}]::float[]) AS similarity
      FROM "Content"
      WHERE "userId" = $1
      ORDER BY similarity DESC
      LIMIT 20;
    `,
      userId
    );

    if (!contents || contents.length === 0) {
      res.status(404).json({
        message: "No content found matching the query.",
        success: false,
      });
      return;
    }

    // Return the search results
    res.status(200).json({
      message: "Search results retrieved successfully.",
      data: contents,
      success: true,
    });
  } catch (error) {
    console.error("Error during search:", error);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
