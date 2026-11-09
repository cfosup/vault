/**
 * ExpenseFlow API Metrics & Endpoint Monitoring Service
 * Tracks incoming API calls, GraphQL operations, status codes, and error logs in real-time.
 */

import mongoose from 'mongoose';

const endpointSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true },
  endpoint: String,
  path: String,
  method: String,
  calls: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  lastCalledAt: Date,
});

const errorSchema = new mongoose.Schema({
  endpoint: String,
  statusCode: Number,
  errorMessage: String,
  timestamp: { type: Date, default: Date.now },
});

const totalsSchema = new mongoose.Schema({
  singleton: { type: String, default: 'global', unique: true },
  totalCalls: { type: Number, default: 0 },
  totalErrors: { type: Number, default: 0 },
});

const EndpointMetric = mongoose.models.ApiEndpointMetric || mongoose.model('ApiEndpointMetric', endpointSchema);
const ApiErrorLog = mongoose.models.ApiErrorLogEntry || mongoose.model('ApiErrorLogEntry', errorSchema);
const ApiTotals = mongoose.models.ApiTotals || mongoose.model('ApiTotals', totalsSchema);

class ApiMetricsService {
  constructor() {
    this.endpoints = new Map();
    this.recentErrors = [];
    this.maxRecentErrors = 50;
    this.totalCalls = 0;
    this.totalErrors = 0;
  }

  async recordRequest(endpointName, path, method, statusCode, errorMessage = null) {
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

    if (mongoose.connection.readyState === 1) {
      const callsInc = 1;
      const errorsInc = isError ? 1 : 0;
      ApiTotals.updateOne(
        { singleton: 'global' },
        { $inc: { totalCalls: callsInc, totalErrors: errorsInc }, $setOnInsert: { singleton: 'global' } },
        { upsert: true }
      ).catch(() => {});
      EndpointMetric.updateOne(
        { key },
        {
          $inc: { calls: callsInc, errorCount: errorsInc },
          $set: {
            endpoint: endpointName,
            path,
            method,
            lastCalledAt: new Date(),
          },
        },
        { upsert: true }
      ).catch(() => {});
      if (isError && errorMessage) {
        ApiErrorLog.create({
          endpoint: endpointName,
          statusCode: statusCode || 500,
          errorMessage: String(errorMessage).substring(0, 300),
          timestamp: new Date(),
        }).catch(() => {});
      }
    }

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

  async getMetrics() {
    if (mongoose.connection.readyState === 1) {
      const [totals, endpoints, errors] = await Promise.all([
        ApiTotals.findOne({ singleton: 'global' }),
        EndpointMetric.find({}).sort({ calls: -1 }).limit(50),
        ApiErrorLog.find({}).sort({ timestamp: -1 }).limit(this.maxRecentErrors),
      ]);
      const totalCalls = totals?.totalCalls || 0;
      const totalErrors = totals?.totalErrors || 0;
      return {
        totalCalls,
        totalErrors,
        overallSuccessRate: totalCalls > 0
          ? Number((((totalCalls - totalErrors) / totalCalls) * 100).toFixed(1))
          : 100,
        endpoints: endpoints.map((row) => ({
          endpoint: row.endpoint,
          path: row.path,
          method: row.method,
          calls: row.calls,
          errors: row.errorCount,
          successRate: row.calls > 0
            ? Number((((row.calls - row.errorCount) / row.calls) * 100).toFixed(1))
            : 100,
          lastCalledAt: row.lastCalledAt ? row.lastCalledAt.toISOString() : new Date().toISOString(),
        })),
        recentErrors: errors.map((row) => ({
          id: row._id.toString(),
          endpoint: row.endpoint,
          statusCode: row.statusCode,
          errorMessage: row.errorMessage,
          timestamp: row.timestamp ? row.timestamp.toISOString() : new Date().toISOString(),
        })),
      };
    }

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

