import { PaginationMeta } from '../interfaces/api-response.interface';

export function buildPaginationMeta(params: {
  page: number;
  limit: number;
  total: number;
}): PaginationMeta {
  const { page, limit, total } = params;

  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
