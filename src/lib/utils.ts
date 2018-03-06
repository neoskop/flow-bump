import { SemVer } from 'semver';
import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import * as fs from 'fs-extra';
import { catchError, switchMap } from 'rxjs/operators';
import { git } from './cmd';
import { _throw } from 'rxjs/observable/throw';

export function mainVersion(v : SemVer) {
    return `${v.major}.${v.minor}.${v.patch}`;
}

export function readPkgIntoContext(file : string, ctx : { pkg? : any }) : Observable<void> {
    return Observable.create(async (subscriber : Subscriber<void>) => {
        try {
            ctx.pkg = JSON.parse(await fs.readFile(file, 'utf-8'));
            subscriber.next();
            subscriber.complete();
        } catch(e) {
            subscriber.error(e);
            subscriber.complete();
        }
        
        return () => {}
    })
}

export function waitForInput(stream = process.stdin) : Observable<void> {
    return Observable.create((subscriber : Subscriber<void>) => {
        function listener() {
            subscriber.next();
            subscriber.complete();
        }
        stream.addListener('data', listener);
        
        return () => {
            stream.removeListener('data', listener);
        }
    })
}

export function handleConflictError(task : any) {
    return catchError(err => {
        if(/CONFLICT/.test(err.message)) {
            task.output = 'Resolve merge conflicts and then hit enter';
            return waitForInput().pipe(
                switchMap(() => git.commit(null, [ '--no-edit', '--no-ff' ]))
            )
        }
        return _throw(err);
    })
}
