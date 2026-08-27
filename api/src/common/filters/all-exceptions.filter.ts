import {
    ArgumentsHost,
    Catch, 
    ExceptionFilter, 
    HttpException, 
    HttpStatus,
    Logger
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter{
    catch(exception: unknown, host: ArgumentsHost): void {
        const logger = new Logger(AllExceptionsFilter.name);
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';


        if (exception instanceof HttpException) {
            status = exception.getStatus() ;
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
                let msg = exceptionResponse.message as string;
                if(Array.isArray(msg)) {
                    msg = msg.join(', ');
                    message = msg;
                }
                else if(msg){
                    message = msg;
                } 
                else {
                    message = exceptionResponse.message as string;
                }
            } else if (exception instanceof Error) {
                message = exception.message;
          
                if ((exception as any).name === 'CastError') {
                  status = HttpStatus.BAD_REQUEST;
                }else{
                    logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
                }
            }
        }
        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: message
        });
    }
}