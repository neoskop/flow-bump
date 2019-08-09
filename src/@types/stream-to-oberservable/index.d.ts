declare module "stream-to-observable" {
    import { Observable } from 'rxjs';
    
    const streamToObservable : (stream : ReadableStream, options?: { await : any }) => Observable<any>;
    
    export = streamToObservable;
}
