export interface RawMarketItem {
  item_id: number;
  category_id: number;
  item_state: string;
  price: number;
  price_currency: string;
  title?: string;
  title_en?: string;
  description?: string;
  account_login?: string;
  account_password?: string;
  steam_country?: string;
  steam_id?: string;
  steam_level?: number;
  loginusers_login?: string;
  warranty_end_at?: number;
  item_origin?: string;
  category?: { category_id: number; title: string; name: string };
  [key: string]: unknown;
}

export interface RawOrdersResponse {
  items: RawMarketItem[];
  totalItems: number;
  /** Authoritative "more pages?" flag from the API. */
  hasNextPage: boolean;
  perPage: number;
  page: number;
}

export interface EmailCodeData {
  code: string;
  date: number;
  textPlain?: string;
}

export type EmailCodeResponse =
  | { item?: unknown; codeData: EmailCodeData }
  | { error: string; errors?: string[] | string };

export interface TelegramLoginCodeData {
  code: string;
  date: number;
}

export type TelegramLoginCodeResponse =
  | { item?: unknown; codes: TelegramLoginCodeData[] }
  | { item?: unknown; codeData: TelegramLoginCodeData }
  | { error: string; errors?: string[] | string };
