"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedLegalPages = void 0;
const legal_model_1 = require("../app/modules/legal/legal.model");
const logger_1 = require("../shared/logger");
const legalPages = [
    {
        title: 'Privacy Policy',
        slug: 'privacy-policy',
        content: `
      <h2>Privacy Policy</h2>
      <p>Your privacy is important to us. It is our policy to respect your privacy regarding any information we may collect from you across our website, and other sites we own and operate.</p>
      <p>We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent.</p>
    `,
        status: 'PUBLISHED',
    },
    {
        title: 'Terms of Service',
        slug: 'terms-of-service',
        content: `
      <h2>Terms of Service</h2>
      <p>By accessing our website, you are agreeing to be bound by these terms of service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws.</p>
      <p>If you do not agree with any of these terms, you are prohibited from using or accessing this site.</p>
    `,
        status: 'PUBLISHED',
    },
    {
        title: 'Refund Policy',
        slug: 'refund-policy',
        content: `
      <h2>Refund Policy</h2>
      <p>We offer a full money-back guarantee for all purchases made on our website. If you are not satisfied with the product that you have purchased from us, you can get your money back no questions asked.</p>
      <p>You are eligible for a full reimbursement within 14 calendar days of your purchase.</p>
    `,
        status: 'PUBLISHED',
    },
];
const seedLegalPages = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        for (const page of legalPages) {
            const exists = yield legal_model_1.LegalPage.findOne({ slug: page.slug });
            if (!exists) {
                yield legal_model_1.LegalPage.create(page);
            }
        }
    }
    catch (err) {
        logger_1.errorLogger.error('❌ Error seeding legal pages:', err);
        throw err;
    }
});
exports.seedLegalPages = seedLegalPages;
