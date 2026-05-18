"use strict";

module.exports = async function errorHandler(fastify) {
  fastify.setErrorHandler(function (error, request, reply) {
    const statusCode = error.statusCode || 500;

    if (error.validation) {
      return reply.code(400).send({
        type: "https://httpstatuses.com/400",
        title: "Помилка валідації запиту",
        status: 400,
        detail: error.message,
        instance: request.url,
        errors: error.validation,
      });
    }

    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return reply.code(409).send({
        type: "https://httpstatuses.com/409",
        title: "Конфлікт: запис вже існує",
        status: 409,
        detail: error.message,
        instance: request.url,
      });
    }

    if (error.code === "NOT_FOUND") {
      return reply.code(404).send({
        type: "https://httpstatuses.com/404",
        title: "Ресурс не знайдено",
        status: 404,
        detail: error.message,
        instance: request.url,
      });
    }

    if (error.code === "CONFLICT") {
      return reply.code(409).send({
        type: "https://httpstatuses.com/409",
        title: "Конфлікт",
        status: 409,
        detail: error.message,
        instance: request.url,
      });
    }

    if (error.code === "FORBIDDEN") {
      return reply.code(403).send({
        type: "https://httpstatuses.com/403",
        title: "Доступ заборонено",
        status: 403,
        detail: error.message,
        instance: request.url,
      });
    }

    fastify.log.error({ err: error, url: request.url }, "Unhandled error");

    return reply.code(statusCode).send({
      type: `https://httpstatuses.com/${statusCode}`,
      title: statusCode === 500 ? "Внутрішня помилка сервера" : error.message,
      status: statusCode,
      detail: statusCode === 500 ? "Зверніться до адміністратора" : error.message,
      instance: request.url,
    });
  });

  fastify.setNotFoundHandler(function (request, reply) {
    reply.code(404).send({
      type: "https://httpstatuses.com/404",
      title: "Маршрут не знайдено",
      status: 404,
      detail: `Маршрут ${request.method} ${request.url} не існує`,
      instance: request.url,
    });
  });
};
