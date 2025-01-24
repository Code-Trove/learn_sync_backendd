// types/index.ts
export interface User {
  id: number;
  // Add other user properties as needed
}

export interface SearchResult {
  id: number;
  title: string;
  extractedText: string;
  author: string;
  similarity: number;
}
