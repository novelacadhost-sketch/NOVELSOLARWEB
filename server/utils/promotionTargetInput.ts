import { z } from 'zod'
import { ALL_PRODUCTS, type PromotionTarget } from '#shared/promotionTarget'

const MAX_ENTRIES = 200

/** "Applies to" as the admin Promotions page sends it. Optional: absent means every product. */
export const promotionTargetSchema = z
  .object({
    appliesTo: z.enum(['all', 'sections', 'products']),
    sections: z.array(z.string().trim().min(1).max(120)).max(MAX_ENTRIES).default([]),
    productIds: z
      .array(z.union([z.string(), z.number()]).transform((v) => String(v).trim()))
      .max(MAX_ENTRIES)
      .default([]),
  })
  .superRefine((t, ctx) => {
    if (t.appliesTo === 'sections' && !t.sections.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose at least one section, or apply it to all products.' })
    }
    if (t.appliesTo === 'products' && !t.productIds.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose at least one product, or apply it to all products.' })
    }
    if (t.productIds.some((id) => !/^\d{1,12}$/.test(id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A selected product has an invalid id.' })
    }
  })
  .optional()

/** The validated input as a target, with only the list its scope uses. */
export function toTarget(input: z.infer<typeof promotionTargetSchema>): PromotionTarget {
  if (!input || input.appliesTo === 'all') return ALL_PRODUCTS
  if (input.appliesTo === 'sections') return { appliesTo: 'sections', sections: [...new Set(input.sections)], productIds: [] }
  return { appliesTo: 'products', sections: [], productIds: [...new Set(input.productIds)] }
}

/** The three columns promo_codes and promotion_settings store it in. */
export function targetColumns(target: PromotionTarget) {
  return {
    applies_to: target.appliesTo,
    target_sections: target.sections,
    target_product_ids: target.productIds,
  }
}
