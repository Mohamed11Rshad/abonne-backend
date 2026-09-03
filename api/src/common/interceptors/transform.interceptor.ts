import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { I18nContext } from 'nestjs-i18n';

export interface UnifiedResponse<T> {
  message: string;
  status: number;
  data: T;
}

interface PaginatedResult<T> {
  data: T;
  total: number;
  page: number;
  limit: number;
}

interface MessageResult {
  message: string;
  [key: string]: unknown;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  UnifiedResponse<T> | T | StreamableFile
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<UnifiedResponse<T> | T | StreamableFile> {
    return next.handle().pipe(
      map((value) => {
        if (value instanceof StreamableFile) {
          return value;
        }

        const i18n = I18nContext.current();
        const request = context.switchToHttp().getRequest();
        
        const status = context.switchToHttp().getResponse().statusCode;

        let message = 'Success';
        let data: any = value;

        if (this.isMessageResult(value)) {
          if (typeof value.message === 'object' && ('en' in value.message || 'ar' in value.message)) {
            const langHeader = request.headers['accept-language'] || request.headers['lang'] || 'ar';
            const lang = (langHeader as string).startsWith('en') ? 'en' : 'ar';
            message = (value.message as any)[lang] || (value.message as any)['ar'] || (value.message as any)['en'];
          } else {
            message = i18n ? (i18n.t(value.message, { defaultValue: value.message }) as string) : value.message;
          }

          const { message: _msg, ...rest } = value;
          void _msg;

          const restKeys = Object.keys(rest);
          if (restKeys.length === 1 && restKeys[0] === 'data') {
            data = (rest as any).data;
          } else if (restKeys.length > 0) {
            data = rest;
          } else {
            data = null;
          }
        }

        if (data && typeof data === 'object' && !Array.isArray(data)) {
          if ('meta' in data && 'data' in data) {
            data = {
              items: data.data,
              ...data.meta,
            };
          } else if (this.isPaginatedResult(data)) {
            const { data: innerData, total, page, limit } = data;
            data = {
              items: innerData,
              pagination: {
                totalItems: total,
                currentPage: page,
                limitPerPage: limit,
                totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
              },
            };
          }
        }

        return { message, status, data };
      }),
    );
  }

  private isMessageResult(value: unknown): value is MessageResult {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const { message } = value as any;
    const isString = typeof message === 'string';
    const isLocalized =
      message &&
      typeof message === 'object' &&
      'en' in message &&
      'ar' in message;

    return isString || isLocalized;
  }

  private isPaginatedResult<K>(value: unknown): value is PaginatedResult<K> {
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'data' in value &&
      'total' in value &&
      'page' in value &&
      'limit' in value &&
      typeof (value as PaginatedResult<K>).total === 'number' &&
      typeof (value as PaginatedResult<K>).page === 'number' &&
      typeof (value as PaginatedResult<K>).limit === 'number'
    );
  }
}
