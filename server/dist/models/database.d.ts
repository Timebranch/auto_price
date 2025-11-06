import sqlite3 from 'sqlite3';
export declare const db: sqlite3.Database;
export interface User {
    id: number;
    username: string;
    email: string;
    password_hash: string;
    full_name?: string;
    avatar_url?: string;
    phone?: string;
    role: 'admin' | 'sales' | 'user' | 'finance';
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
export interface QuoteTemplate {
    id: number;
    name: string;
    description: string;
    template_html: string;
    fields: string;
    created_by: number;
    created_at: string;
    updated_at: string;
}
export interface QuoteRecord {
    id: number;
    template_id: number;
    user_id: number;
    title: string;
    form_data: string;
    generated_pdf_path?: string;
    status: 'draft' | 'completed';
    created_at: string;
    updated_at: string;
}
export interface QuoteItem {
    id: number;
    quote_id: number;
    item_name: string;
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    sort_order: number;
}
export interface KnowledgeArticle {
    id: number;
    title: string;
    content: string;
    author_id?: number;
    created_at: string;
    updated_at: string;
}
export interface DeliveryNote {
    id: number;
    order_name: string;
    customer_name: string;
    delivery_time: string;
    created_by: number;
    file_path?: string;
    status?: 'draft' | 'pending_review' | 'approved' | 'rejected';
    license_plate?: string;
    driver_name?: string;
    driver_phone?: string;
    receiver_name?: string;
    receiver_phone?: string;
    shipper_name?: string;
    shipper_phone?: string;
    address?: string;
    note?: string;
    created_at: string;
    updated_at: string;
}
export interface SettlementRecord {
    id: number;
    delivery_id: number;
    order_name: string;
    customer_name: string;
    delivery_date: string;
    address?: string;
    shipper_name?: string;
    created_by: number;
    items: string;
    total_price: number;
    created_at: string;
    updated_at: string;
}
export interface TechnicalTask {
    id: number;
    project_name: string;
    customer_name: string;
    sales_owner_id: number;
    technician_id?: number;
    client_contact_name: string;
    client_contact_phone: string;
    start_time: string;
    deadline: string;
    deliverables: string;
    attachments_path?: string;
    status: 'draft' | 'active';
    author_id: number;
    created_at: string;
    updated_at: string;
}
export declare function initDatabase(): Promise<void>;
//# sourceMappingURL=database.d.ts.map