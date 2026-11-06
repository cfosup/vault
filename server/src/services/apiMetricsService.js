/**
 * ExpenseFlow API Metrics & Endpoint Monitoring Service
 * Tracks incoming API calls, GraphQL operations, status codes, and error logs in real-time.
 */

class ApiMetricsService {
  constructor() {
    this.endpoints = new Map();
    this.recentErrors = [];
    this.maxRecentErrors = 50;
    this.totalCalls = 0;
    this.totalErrors = 0;
  }

  recordRequest(endpointName, path, method, statusCode, errorMessage = null) {
    this.totalCalls++;
    const isError = statusCode >= 400 || !!errorMessage;
    if (isError) this.totalErrors++;

    const key = `${method} ${endpointName}`;
    const existing = this.endpoints.get(key) || {
      endpoint: endpointName,
      path,
      method,
      calls: 0,
      errors: 0,
      successRate: 100,
      lastCalledAt: new Date().toISOString(),
    };

    existing.calls++;
    if (isError) existing.errors++;
    existing.successRate = Number(
      (((existing.calls - existing.errors) / existing.calls) * 100).toFixed(1)
    );
    existing.lastCalledAt = new Date().toISOString();

    this.endpoints.set(key, existing);

    if (isError && errorMessage) {
      this.recentErrors.unshift({
        id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        endpoint: endpointName,
        statusCode: statusCode || 500,
        errorMessage: String(errorMessage).substring(0, 300),
        timestamp: new Date().toISOString(),
      });
      if (this.recentErrors.length > this.maxRecentErrors) {
        this.recentErrors.pop();
      }
    }
  }

  getMetrics() {
    const endpointsList = Array.from(this.endpoints.values()).sort(
      (a, b) => b.calls - a.calls
    );

    const overallSuccessRate =
      this.totalCalls > 0
        ? Number(
            (((this.totalCalls - this.totalErrors) / this.totalCalls) * 100).toFixed(1)
          )
        : 100;

    return {
      totalCalls: this.totalCalls,
      totalErrors: this.totalErrors,
      overallSuccessRate,
      endpoints: endpointsList,
      recentErrors: this.recentErrors,
    };
  }
}

export const apiMetrics = new ApiMetricsService();

/**
 * Express middleware to track all REST and GraphQL requests
 */
export const apiMetricsMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    let endpointName = req.path;

    // Detect GraphQL operation from body
    if (req.path === '/graphql' && req.body) {
      if (req.body.operationName) {
        endpointName = `GraphQL: ${req.body.operationName}`;
      } else if (typeof req.body.query === 'string') {
        const match = req.body.query.match(/(query|mutation|subscription)\s+([A-Za-z0-9_]+)/);
        if (match && match[2]) {
          endpointName = `GraphQL: ${match[2]}`;
        } else {
          // Check root fields
          const fieldMatch = req.body.query.match(/{\s*([A-Za-z0-9_]+)/);
          if (fieldMatch && fieldMatch[1]) {
            endpointName = `GraphQL: ${fieldMatch[1]}`;
          } else {
            endpointName = 'GraphQL: query';
          }
        }
      }
    } else {
      endpointName = `REST: ${req.path}`;
    }

    const statusCode = res.statusCode;
    const isError = statusCode >= 400;
    const errorMessage = isError ? res.statusMessage || `HTTP ${statusCode}` : null;

    apiMetrics.recordRequest(endpointName, req.path, req.method, statusCode, errorMessage);
  });

  next();
};

export default {
  apiMetrics,
  apiMetricsMiddleware,
};

