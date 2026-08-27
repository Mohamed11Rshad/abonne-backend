import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';

export function ApiUnifiedResponse<T extends Type<unknown>>(
  model: T,
  status: 'ok' | 'created' = 'ok',
  messageExample: string = 'Success',
  dataExample?: Record<string, unknown>,
) {
  const decorator = status === 'created' ? ApiCreatedResponse : ApiOkResponse;

  const schema: any = {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        example: messageExample,
      },
      status: {
        type: 'number',
        example: status === 'created' ? 201 : 200,
      },
      data: {
        allOf: [{ $ref: getSchemaPath(model) }],
      },
    },
  };

  if (dataExample) {
    schema.example = {
      message: messageExample,
      status: status === 'created' ? 201 : 200,
      data: dataExample,
    };
  }

  return applyDecorators(ApiExtraModels(model), decorator({ schema }));
}
