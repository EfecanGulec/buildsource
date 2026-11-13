import type { LensProduct } from "./lens";

// Keep source indices intact: filtering out non-material products must not shift photos.
export function lensItemPhotos(product: LensProduct, paths: string[]) {
  return {
    itemTitle: product.item_name,
    photoPaths: [...new Set(product.photo_indices)].flatMap((index) => {
      const path = paths[index];
      return path ? [path] : [];
    }),
  };
}