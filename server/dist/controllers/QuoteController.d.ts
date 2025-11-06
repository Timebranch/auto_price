import { Request, Response } from 'express';
export declare class QuoteController {
    getTemplates(req: Request, res: Response): Promise<void>;
    getTemplate(req: Request, res: Response): Promise<void>;
    createQuoteRecord(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getQuoteRecords(req: Request, res: Response): Promise<void>;
    getQuoteRecord(req: Request, res: Response): Promise<void>;
    updateQuoteRecord(req: Request, res: Response): Promise<void>;
    deleteQuoteRecord(req: Request, res: Response): Promise<void>;
    generatePDF(req: Request, res: Response): Promise<void>;
    downloadPDF(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=QuoteController.d.ts.map