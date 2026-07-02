'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/shared/errors.js
 * ════════════════════════════════════════════════════════════════════
 * Classificação estruturada de erros da aplicação.
 * Permite distinguir tipo de erro no handler principal (api.js) para
 * devolver HTTP status codes semânticos e mensagens consistentes.
 *
 * Categorias:
 *   - ValidationError     → 400 Bad Request
 *   - AuthError           → 401 Unauthorized
 *   - ForbiddenError      → 403 Forbidden
 *   - NotFoundError       → 404 Not Found
 *   - ConflictError       → 409 Conflict
 *   - ParserError         → 422 Unprocessable Entity
 *   - StorageError        → 503 Service Unavailable
 *   - AppError (genérico) → 500 Internal Server Error
 * ════════════════════════════════════════════════════════════════════
 */

class AppError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = this.constructor.name;
    this.code = code || 'INTERNAL_ERROR';
    this.statusCode = statusCode || 500;
  }
}

class ValidationError extends AppError {
  constructor(message, field) {
    super(message, 'VALIDATION_ERROR', 400);
    this.field = field || null;
  }
}

class AuthError extends AppError {
  constructor(message) {
    super(message, 'AUTH_ERROR', 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message) {
    super(message, 'FORBIDDEN_ERROR', 403);
  }
}

class NotFoundError extends AppError {
  constructor(entity, id) {
    super(`${entity || 'Entidade'} não encontrada${id ? ': ' + id : ''}.`, 'NOT_FOUND', 404);
    this.entity = entity;
    this.entityId = id;
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 'CONFLICT_ERROR', 409);
  }
}

class ParserError extends AppError {
  constructor(message) {
    super(message, 'PARSER_ERROR', 422);
  }
}

class StorageError extends AppError {
  constructor(message) {
    super(message, 'STORAGE_ERROR', 503);
  }
}

/**
 * Determina o HTTP status code adequado a partir de qualquer Error.
 * Para erros genéricos (não classificados), devolve 200 (compatibilidade
 * com o comportamento atual de api.js que sempre devolve {ok:false, erro}).
 */
function resolverStatusCode(err) {
  if (err instanceof AppError) return err.statusCode;
  return 200; // erros de negócio devolvem 200 com {ok:false}
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ParserError,
  StorageError,
  resolverStatusCode
};
