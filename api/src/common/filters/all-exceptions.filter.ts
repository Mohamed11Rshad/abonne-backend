import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { I18nContext } from 'nestjs-i18n';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const i18n = I18nContext.current(host);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const msg = (exceptionResponse as any).message;
        if (Array.isArray(msg)) {
          message = msg.join('; ');
        } else if (msg) {
          message = msg;
        } else {
          message = exception.message;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;

      if ((exception as any).name === 'CastError') {
        status = HttpStatus.BAD_REQUEST;
      } else {
        this.logger.error(
          `Unhandled exception: ${exception.message}`,
          exception.stack,
        );
      }
    }

    if (i18n && typeof message === 'string') {
      message = i18n.t(message, { defaultValue: message }) as string;
    }

    response.status(status).json({
      message,
      status,
      data: null,
    });
  }
}
