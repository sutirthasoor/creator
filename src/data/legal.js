import { COMPANY, POLICY } from "./company.js";

const addr = COMPANY.addressLines.join(", ");

// Each policy: { slug, path, title, short, intro, sections: [{ heading, paras?, list? }] }
export const POLICIES = [
  {
    slug: "terms",
    path: "/terms",
    title: "Terms & Conditions",
    short: "The rules for using this website and buying the Masterbook.",
    intro: `These Terms & Conditions govern your use of the Creator Moves 365 website (the “Site”) and your purchase of digital products from it. The Site is operated by ${COMPANY.legalName} (“${COMPANY.shortName}”, “we”, “us”). By browsing the Site or placing an order you agree to these Terms. If you do not agree, please do not use the Site.`,
    sections: [
      {
        heading: "1. Who we are",
        paras: [
          `${COMPANY.legalName}, trading as ${COMPANY.brand}. Registered address: ${addr}. GSTIN: ${COMPANY.gstin}. Email: ${COMPANY.email}. Phone: ${COMPANY.phoneDisplay}.`,
        ],
      },
      {
        heading: "2. Eligibility",
        paras: [
          "You must be at least 18 years old, or use the Site under the supervision of a parent or guardian who agrees to these Terms, and be able to enter into a binding contract under Indian law.",
        ],
      },
      {
        heading: "3. What we sell",
        paras: [
          "The Site sells digital publications, currently “The Top Secret Content Collection Book Of The Viral Influencers” (the “Masterbook”): nine chapters, five case studies and twelve studio prompts. The Masterbook is read in a private online reader. No physical item is shipped.",
          "The AI Library is a separate offering with its own subscription terms, which will be published before it is sold.",
        ],
      },
      {
        heading: "4. Prices and payment",
        list: [
          "All prices are in Indian Rupees (INR) and are charged in INR. Taxes, including GST where applicable, are shown or applied at checkout.",
          "The Site can display prices in other currencies for your convenience. Those figures are indicative only, based on exchange rates that change, and are not the amount charged. Your bank or card issuer may apply its own conversion rate and fees.",
          `Payments are processed by ${POLICY.paymentGateway} and, where applicable, our e-commerce platform. We do not see or store your full card, UPI or bank details.`,
          "Launch discounts and offers are time-limited and may be changed or withdrawn at any time. The price you see when you pay is the price you are charged.",
          "We may cancel an order and refund you in full if a pricing or listing error is found.",
        ],
      },
      {
        heading: "5. Access to your purchase",
        paras: [
          `Access to the Masterbook opens only after your payment is verified. It is then available through your private order link and, when you are signed in, from your Library. Please read our Shipping & Delivery Policy and Refund & Cancellation Policy for details.`,
        ],
      },
      {
        heading: "6. Licence and acceptable use",
        paras: [
          "When you buy the Masterbook we grant you a personal, non-exclusive, non-transferable licence to read it for your own use and to print or save a copy for your own reference using the reader’s Print option.",
        ],
        list: [
          "Do not copy, resell, share, publish, upload or otherwise distribute the Masterbook or any part of it.",
          "Do not share your private order link or account with others.",
          "Do not attempt to bypass the reader, scrape the Site, or interfere with its security or operation.",
          "You may use the ideas and prompts in your own content. Check and adapt any output before publishing it, and respect the rights of others.",
        ],
      },
      {
        heading: "7. Intellectual property",
        paras: [
          `The Masterbook, the Site, the ${COMPANY.brand} name and logo, and all text, images, designs and prompts are owned by ${COMPANY.legalName} or its licensors and protected by copyright and other laws. Buying the Masterbook does not transfer any ownership.`,
        ],
      },
      {
        heading: "8. No guarantee of results",
        paras: [
          "The Masterbook is educational and creative guidance. We do not promise any particular outcome such as followers, views, income or brand deals. Results depend on your own effort, content, audience and platforms. Case studies describe publicly visible work and are not endorsements of, or affiliations with, the people or brands mentioned.",
        ],
      },
      {
        heading: "9. Accounts",
        paras: [
          "If you create an account, keep your sign-in details secure and tell us promptly if you suspect misuse. You are responsible for activity under your account. We may suspend accounts that breach these Terms.",
        ],
      },
      {
        heading: "10. Affiliate and partner programme",
        paras: [
          "Participation in the affiliate or influencer programme is governed by the programme terms shown in the partner area. Commission rates and payout rules are set there and may change with notice.",
        ],
      },
      {
        heading: "11. Availability and changes",
        paras: [
          "We try to keep the Site available but do not guarantee uninterrupted access. We may update the Site, the Masterbook’s presentation and these Terms from time to time. The version published here, with its “last updated” date, applies from the date it is posted.",
        ],
      },
      {
        heading: "12. Limitation of liability",
        paras: [
          `To the extent permitted by law, ${COMPANY.shortName} is not liable for indirect, incidental or consequential loss, or for loss of profit, data or opportunity, arising from use of the Site or the Masterbook. Our total liability for any claim relating to a purchase is limited to the amount you paid for that purchase. Nothing here limits liability that cannot be limited by law.`,
        ],
      },
      {
        heading: "13. Governing law and disputes",
        paras: [
          `These Terms are governed by the laws of India. Courts at ${POLICY.jurisdiction} have exclusive jurisdiction, subject to any mandatory consumer rights you have under applicable law. Please contact us first at ${COMPANY.email}; most issues can be resolved quickly without a formal dispute.`,
        ],
      },
      {
        heading: "14. Contact",
        paras: [`Questions about these Terms: ${COMPANY.email}, ${COMPANY.phoneDisplay}, ${addr}.`],
      },
    ],
  },

  {
    slug: "privacy",
    path: "/privacy",
    title: "Privacy Policy",
    short: "What personal data we collect, why, and the choices you have.",
    intro: `${COMPANY.legalName} (“${COMPANY.shortName}”, “we”, “us”) respects your privacy. This policy explains what personal data we collect through the Creator Moves 365 website, how we use it, who we share it with and what rights you have, in line with applicable Indian law including the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.`,
    sections: [
      {
        heading: "1. Data we collect",
        list: [
          "Details you give us: name, email address, phone number and message when you contact us, create an account, or place an order.",
          "Order details: the products you buy, order number, amounts and payment status. Payment details are entered with our payment processor, not with us.",
          "Account data: your sign-in details and your order history, held through our store platform’s customer accounts.",
          "Partner programme data: if you join as an affiliate or influencer, the details you submit and the referral activity linked to your code.",
          "Technical data: browser and device type, pages visited and approximate region, collected through standard server logs.",
          "Small items stored in your browser: your cart, your chosen display currency, your sign-in session and a referral code if you arrived through a partner link.",
        ],
      },
      {
        heading: "2. How we use it",
        list: [
          "To process orders, verify payment and give you access to what you bought.",
          "To run your account and answer your questions and support requests.",
          "To send order and access messages. We send marketing only where you have asked for it, and you can opt out at any time.",
          "To credit referrals and calculate partner commission.",
          "To prevent fraud and abuse, keep the Site secure and meet legal, tax and accounting duties.",
          "To understand how the Site is used and improve it.",
        ],
      },
      {
        heading: "3. Payments",
        paras: [
          `Online payments are handled by ${POLICY.paymentGateway}. Your card, UPI or net-banking details are submitted directly to the payment processor and are subject to its privacy policy. We receive only the result of the payment (for example paid, failed or refunded), a payment reference and the amount.`,
        ],
      },
      {
        heading: "4. Who we share data with",
        paras: [
          "We do not sell your personal data. We share it only with service providers who help us run the Site, under obligations to protect it: our payment processor, our e-commerce platform, cloud hosting and database providers, and email delivery tools. We may also disclose data where required by law or to protect our rights, users or the public.",
          "Some of these providers may store or process data outside India. We use providers that apply appropriate safeguards.",
        ],
      },
      {
        heading: "5. Cookies and local storage",
        paras: [
          "We use browser storage for things the Site needs to work: keeping your cart, remembering your display currency, keeping you signed in and remembering a referral code. You can clear this data in your browser settings; some features may then reset or stop working.",
        ],
      },
      {
        heading: "6. How long we keep data",
        paras: [
          "We keep personal data only as long as needed for the purposes above. Order and tax records are kept for the period required by law. Contact messages are kept while we deal with your request and for a reasonable period after.",
        ],
      },
      {
        heading: "7. Security",
        paras: [
          "We use reasonable technical and organisational safeguards, including encrypted connections. No online service is completely secure, so we cannot guarantee absolute security.",
        ],
      },
      {
        heading: "8. Your rights",
        paras: [
          `You can ask us to give you a summary of the data we hold about you, correct or update it, or erase it where we no longer need it. You can withdraw consent you gave us, and you can nominate someone to exercise these rights for you. Write to ${COMPANY.email} and we will respond within a reasonable time. If you are not satisfied, you may complain to the Data Protection Board of India once it is functioning.`,
        ],
      },
      {
        heading: "9. Children",
        paras: [
          "The Site is not directed at children under 18. We do not knowingly collect their personal data without a parent or guardian’s consent. If you think a child has given us data, please contact us and we will delete it.",
        ],
      },
      {
        heading: "10. Changes to this policy",
        paras: ["We may update this policy. The current version and its “last updated” date are always on this page."],
      },
      {
        heading: "11. Grievance and contact",
        paras: [
          `For privacy questions or grievances, contact the Grievance Officer, ${COMPANY.legalName}, ${addr}. Email: ${COMPANY.email}. Phone: ${COMPANY.phoneDisplay}. We aim to reply within ${POLICY.supportReply}.`,
        ],
      },
    ],
  },

  {
    slug: "refund-policy",
    path: "/refund-policy",
    title: "Refund & Cancellation Policy",
    short: "When you can cancel an order and when a refund is available.",
    intro: `The Masterbook is a digital product and access opens as soon as your payment is verified. Because it cannot be returned once access is given, refunds are limited to the situations below. We want you to be treated fairly: if something went wrong on our side, we will fix it or refund you.`,
    sections: [
      {
        heading: "1. Cancelling an order",
        list: [
          "Before payment: you can leave checkout or empty your cart at any time. Nothing is charged.",
          "After payment but before access opens: write to us straight away and we will cancel and refund the order.",
          "After access has opened: the order can no longer be cancelled, because the product has been delivered.",
        ],
      },
      {
        heading: "2. When you are eligible for a refund",
        list: [
          "You were charged but the order was not created or access did not open within the time stated in our Shipping & Delivery Policy, and we cannot fix it.",
          "You were charged more than once for the same order (duplicate payment). The extra amount is refunded.",
          "A technical problem on our side stops you reading the Masterbook and we cannot resolve it within a reasonable time.",
          "The product delivered is materially different from what was described on the Site.",
        ],
      },
      {
        heading: "3. When a refund is not available",
        list: [
          "You changed your mind after access opened, or the book was not what you hoped for in style or depth.",
          "You did not achieve a particular result, such as growth in followers or income. The Masterbook does not promise one.",
          "Access was lost because the order link or account was shared or misused.",
          "The request is made after the refund window has passed.",
        ],
      },
      {
        heading: "4. How to request a refund",
        paras: [
          `Email ${COMPANY.email} within ${POLICY.refundWindowDays} days of payment with your order number, the email used at checkout, the payment reference or a screenshot, and a short description of the problem. You can also call ${COMPANY.phoneDisplay}. We will confirm receipt and aim to review your request within ${POLICY.supportReply}.`,
        ],
      },
      {
        heading: "5. How refunds are paid",
        paras: [
          `Approved refunds are sent to the original payment method through ${POLICY.paymentGateway}. Refunds are initiated within ${POLICY.refundProcessingDays} of approval. Your bank or card issuer may take a few more working days to show the credit. Access to the product ends when a refund is issued.`,
        ],
      },
      {
        heading: "6. Failed or pending payments",
        paras: [
          "If money was debited but the payment shows as failed or pending, it is normally reversed automatically by your bank or the payment processor within a few working days. If it is not, contact us with the payment reference and we will help trace it.",
        ],
      },
      {
        heading: "7. AI Library",
        paras: ["The AI Library is a separate subscription. Its cancellation and refund terms will be published with it."],
      },
    ],
  },

  {
    slug: "shipping-policy",
    path: "/shipping-policy",
    title: "Shipping & Delivery Policy",
    short: "How and when you receive your digital purchase. Nothing is shipped.",
    intro: `Everything sold on Creator Moves 365 is delivered digitally. We do not ship physical goods, so there are no shipping charges, courier delays or delivery addresses to worry about.`,
    sections: [
      {
        heading: "1. How you receive your purchase",
        list: [
          "After you place an order you receive a private order link.",
          "Once your payment is verified, the Masterbook opens in the private online reader through that link. If you have an account, it also appears in your Library when you sign in.",
          "You can read it online and use the reader’s Print option to save a PDF copy for your own use.",
        ],
      },
      {
        heading: "2. Delivery time",
        paras: [
          `Access normally opens within ${POLICY.accessDelay} of payment being verified. Bank and network delays can occasionally make verification slower. If you still do not have access after ${POLICY.accessEscalationHours} hours, email ${COMPANY.email} with your order number and we will sort it out or refund you under our Refund & Cancellation Policy.`,
        ],
      },
      {
        heading: "3. No physical shipping",
        paras: [
          "No physical product is dispatched, so there is no shipping address, tracking number or shipping fee. Delivery is available anywhere with an internet connection.",
        ],
      },
      {
        heading: "4. What you need",
        list: [
          "A modern web browser and a stable internet connection.",
          "The email address or order link you used at checkout.",
        ],
      },
      {
        heading: "5. If you cannot open your purchase",
        paras: [
          `Check that payment has completed and try again from the order link. If it still does not open, contact us at ${COMPANY.email} or ${COMPANY.phoneDisplay}. We reply within ${POLICY.supportReply}.`,
        ],
      },
    ],
  },
];

export const POLICY_BY_SLUG = Object.fromEntries(POLICIES.map((p) => [p.slug, p]));
