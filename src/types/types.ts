export interface ImageAnalysisResult {
  title: string; // A short title for the image
  description: string; // A detailed description of the image
  analysis: {
    details: string; // Any additional information or detailed breakdown
  };
}
