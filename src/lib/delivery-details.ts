import { z } from "zod";

export const deliveryDetailsSchema = z.object({
  city: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  contact: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(80),
  unloading: z.enum(["manual", "crane_needed", "forklift_on_site"]),
  window: z.enum(["any", "morning", "afternoon"]),
  access: z.string().trim().max(2000),
});
export type DeliveryDetails = z.infer<typeof deliveryDetailsSchema>;
export const emptyDeliveryDetails: DeliveryDetails = { city: "", address: "", contact: "", phone: "", unloading: "manual", window: "any", access: "" };

export function needsDeliveryDetails(required: boolean, details: unknown) {
  return required && !deliveryDetailsSchema.safeParse(details).success;
}