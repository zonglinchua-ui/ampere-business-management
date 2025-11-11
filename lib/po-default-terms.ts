
/**
 * Default Terms & Conditions for Purchase Orders
 * Ampere Engineering Pte Ltd - Singapore
 * 
 * These are the standard terms used for all Purchase Orders unless customized.
 */

export const DEFAULT_PO_TERMS = `PURCHASE ORDER TERMS & CONDITIONS

(Ampere Engineering Pte Ltd – Singapore)

1. Definitions

"Buyer" refers to Ampere Engineering Pte Ltd.
"Supplier" refers to the company, firm, or individual to whom this Purchase Order (PO) is issued.
"Goods" / "Materials" / "Services" / "Works" refer to all items, labour, or subcontracted services described in this PO.
"Contract" refers to this PO, together with these Terms and Conditions and any specifications or drawings referenced herein.

2. Acceptance

This Purchase Order constitutes an offer by Ampere Engineering Pte Ltd to purchase the Goods, Materials, or Services on the terms stated herein.
Acceptance of this PO by the Supplier, whether expressly or by commencement of delivery, shall constitute agreement to these Terms and Conditions.
Any deviation from or addition to these terms shall be valid only if agreed in writing by the Buyer.

3. Scope of Work

The scope may include, but is not limited to, the supply of materials, subcontracted works, labour services, or equipment as specified in the Purchase Order.
The Supplier shall ensure that all works are carried out in compliance with the Buyer's project requirements and within agreed timelines.

4. Delivery & Time

Time is of the essence. Delivery and completion shall be strictly in accordance with the schedule, location, and instructions stated in the PO.
The Buyer reserves the right to cancel or reject delayed deliveries without incurring any liability.
The Supplier shall promptly notify the Buyer in writing of any anticipated delay.
Partial deliveries are not permitted unless specifically authorized by the Buyer.

5. Quality & Inspection

All Goods and Works must comply with specifications, approved samples, and applicable Singapore Standards (SS/CP).
The Buyer reserves the right to inspect and reject any Goods or Works found to be defective, non-conforming, or damaged.
Rejected items shall be replaced or rectified at the Supplier's cost without delay.

6. Warranties

The Supplier warrants that:
• All Goods and Works are free from defects in design, materials, and workmanship.
• All items supplied are new and of merchantable quality, unless otherwise agreed.
• All Works comply with applicable laws, regulations, and codes in Singapore.
The warranty period shall be not less than 12 months from the date of delivery or completion, whichever is later.

7. Price & Payment

Prices stated in this PO are firm, fixed, and inclusive of all charges, duties, packaging, delivery, and insurance, unless otherwise stated.
Payment shall be made within 30 days from the date of receipt of a valid tax invoice and acceptance of Goods/Works.
The Buyer reserves the right to withhold payment for incomplete, defective, or disputed items.

8. Invoicing

All invoices must include:
• Purchase Order number
• Description of Goods/Works
• Quantity, unit price, and total amount
• Delivery Order reference and date
Invoices that do not reference the correct PO may be rejected or delayed.

9. Title & Risk

Title and ownership of the Goods shall pass to Ampere Engineering Pte Ltd upon delivery and acceptance.
Risk of loss or damage remains with the Supplier until acceptance by the Buyer.

10. Compliance & Safety

Supplier shall comply with all applicable Workplace Safety and Health (WSH), Building Control, and Environmental regulations.
All site works must adhere to the Buyer's Safety, Health & Environment (SHE) policies.
Suppliers or subcontractors working on site must ensure proper permits, PPE, and safety supervision.

11. Intellectual Property

All drawings, data, or documents provided by the Buyer remain its property and shall not be copied, disclosed, or used for other purposes without written consent.
The Supplier warrants that all Goods and Works do not infringe any third-party intellectual property rights.

12. Termination

The Buyer may terminate this PO, in whole or in part, without liability if:
• The Supplier fails to perform or deliver in accordance with the terms.
• The Supplier becomes insolvent or subject to liquidation.
Upon termination, the Buyer's liability is limited to payment for accepted deliveries made prior to termination.

13. Indemnity

The Supplier shall indemnify and hold harmless Ampere Engineering Pte Ltd, its officers, and agents from all claims, losses, damages, or expenses arising from:
• Defective Goods or Works,
• Breach of contract, or
• Negligence or misconduct of the Supplier, its employees, or agents.

14. Force Majeure

Neither party shall be liable for failure to perform caused by circumstances beyond reasonable control, including natural disasters, war, strikes, or government actions.
The affected party shall notify the other immediately and resume performance when practicable.

15. Confidentiality

All information obtained from the Buyer in connection with this PO shall be treated as confidential and not disclosed to third parties without written consent.

16. Governing Law & Jurisdiction

This Purchase Order shall be governed by and construed in accordance with the laws of the Republic of Singapore.
Any disputes shall be subject to the exclusive jurisdiction of the Singapore Courts.

17. Entire Agreement

This Purchase Order, including these Terms & Conditions, constitutes the entire agreement between Ampere Engineering Pte Ltd and the Supplier, superseding all prior communications or understandings.

All purchases are subject to Ampere Engineering Pte Ltd's Terms & Conditions as stated herein. Acceptance or delivery against this Purchase Order signifies full agreement with these terms.`;

/**
 * Get the default terms for a PO
 * Can be extended to return different terms based on PO type, supplier, etc.
 */
export function getDefaultPOTerms(): string {
  return DEFAULT_PO_TERMS;
}

/**
 * Check if terms are custom (different from default)
 */
export function isCustomTerms(terms: string | null | undefined): boolean {
  if (!terms) return false;
  return terms.trim() !== DEFAULT_PO_TERMS.trim();
}
