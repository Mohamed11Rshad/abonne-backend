import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, throwError, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { CloudinaryService } from '../cloudnairy/cloudinary.service';

@Injectable()
export class CloudinaryFieldsInterceptor implements NestInterceptor {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const files = request.files as { [fieldname: string]: any[] } | undefined;

    if (!files || Object.keys(files).length === 0) {
      return next.handle();
    }

    const uploadPromises: Promise<{ fieldname: string; result: any }>[] = [];

    // Queue uploads for all files across all fields
    for (const fieldname of Object.keys(files)) {
      const fieldFiles = files[fieldname];
      if (!fieldFiles || !Array.isArray(fieldFiles)) continue;
      for (const file of fieldFiles) {
        const uploadPromise = this.cloudinaryService.uploadImage(file).then(uploadResult => ({
          fieldname,
          result: uploadResult
        }));
        uploadPromises.push(uploadPromise);
      }
    }

    return from(Promise.all(uploadPromises)).pipe(
      switchMap((uploadResults) => {
        // Build the results object mapping field names to uploaded image objects
        const cloudinaryResults: { [fieldname: string]: { secure_url: string; public_id: string } } = {};
        
        for (const { fieldname, result } of uploadResults) {
          cloudinaryResults[fieldname] = {
            secure_url: result.secure_url,
            public_id: result.public_id,
          };
        }
        
        request.cloudinaryResults = cloudinaryResults;
        
        // Continue to the handler
        return next.handle().pipe(
          catchError((error) => {
            // Delete all uploaded images if handler fails
            const deletePromises = uploadResults.map(ur => this.cloudinaryService.deleteImage(ur.result.public_id).catch(console.error));
            Promise.all(deletePromises);
            return throwError(() => error);
          })
        );
      }),
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }
}
