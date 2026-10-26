// Company details — taken from the Creator Moves 365 PRD (company identity section).
export const COMPANY = {
  brand: "Creator Moves 365",
  legalName: "Absolute Advancement 100X Tech",
  shortName: "AA100XTech",
  gstin: "10ABCCA6080A1ZH",
  addressLines: ["101 City Plaza, Kidwaipuri", "Patna, Bihar - 800001", "India"],
  email: "customer.care@aa100xtech.com",
  phoneDisplay: "+91 90318 38342",
  phoneHref: "tel:+919031838342",
};

export const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent("101 City Plaza, Kidwaipuri, Patna, Bihar 800001, India");

export const CONTACT_TOPICS = [
  "Order or access help",
  "Payment question",
  "Masterbook content",
  "Affiliate or influencer program",
  "Business or partnership",
  "Something else",
];

// Terms used across the legal pages. Edit them here and every policy page follows.
export const POLICY = {
  updated: "26 October 2026",
  refundWindowDays: 7,        // how long after payment a refund request can be raised
  refundProcessingDays: "5–7 business days", // after a refund is approved
  accessDelay: "a few minutes",              // normal time for access to open after payment
  accessEscalationHours: 24,                 // after this long without access, write to us
  supportReply: "2 business days",
  jurisdiction: "Patna, Bihar, India",
  paymentGateway: "Razorpay",
};
