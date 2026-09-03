import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { CloudinaryService } from '../cloudnairy/cloudinary.service';

@Injectable()
export class CloudinaryInterceptor implements NestInterceptor {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const file = request.file;

    if (!file) {
      return next.handle();
    }

    // Upload to cloudinary before passing to the request handler
    return from(this.cloudinaryService.uploadImage(file)).pipe(
      switchMap((uploadResult) => {
        // Attach the result to the request so the controller/service can use it
        request.cloudinaryResult = {
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
        };
        
        // Continue to the handler
        return next.handle().pipe(
          catchError((error) => {
            // If the handler throws an error, delete the uploaded image from Cloudinary
            this.cloudinaryService.deleteImage(uploadResult.public_id).catch(console.error);
            return throwError(() => error);
          })
        );
      }),
      catchError((error) => {
        // If upload to cloudinary fails, just throw
        return throwError(() => error);
      })
    );
  }
}
