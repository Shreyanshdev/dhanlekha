/**
 * Standard success response — single resource
 */
function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * Standard success response — created resource
 */
function created(res, data) {
  return success(res, data, 201);
}

/**
 * Standard success response — paginated collection
 */
function paginated(res, data, pagination) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  });
}

/**
 * Standard error response
 */
function error(res: any, statusCode: number, code: string, message: string, field: string | null = null) {
  const body: any = {
    success: false,
    error: {
      code,
      message,
    },
  };
  if (field) body.error.field = field;
  return res.status(statusCode).json(body);
}

export { success, created, paginated, error };
