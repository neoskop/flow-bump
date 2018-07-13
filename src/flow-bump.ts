import * as Listr from 'listr';
import * as fs from 'fs-extra';
import * as path from 'path';
import { map, switchMap } from 'rxjs/operators';
import { _throw } from 'rxjs/observable/throw'
import * as semver from 'semver';
import { SemVer } from 'semver';
import { empty } from 'rxjs/observable/empty';
import { concat } from 'rxjs/observable/concat';
import { git, invokeScript } from './lib/cmd';
import { handleConflictError, mainVersion, readPkgIntoContext } from './lib/utils';
import { fromPromise } from 'rxjs/observable/fromPromise';
import { IBranch, IOptions, IPrefix, IScripts } from './types';
import { Command, isFinalCommand, isIncCommand, isMainCommand } from './consts';


export async function flowBump(command : Command, options : IOptions & {
    fromBranch?: string,
    fromTag?: string,
    fromCommit?: string;
    oneShot: boolean,
    version?: string,
    type: 'alpha' | 'beta' | 'rc',
    toBranch: string
}, prefix: IPrefix, branch : IBranch, scripts? : IScripts) {
    options = {
        ...options
    };
    const PKG_FILE = path.join(process.cwd(), 'package.json');
    
    const tasks = new Listr<{
        pkg?: { version: string };
        version?: semver.SemVer;
    }>([]);
    
    let versionTag : string|undefined;
    
    let fromBranch : string|undefined;
    let fromTag : string|undefined;
    let fromCommit : string|undefined;
    if(options.fromBranch) {
        fromBranch = options.fromBranch;
    } else if(options.fromTag) {
        fromTag = options.fromTag;
    } else if(options.fromCommit) {
        fromCommit = options.fromCommit;
    } else {
        if(command === 'hotfix') {
            fromBranch = branch.master;
        } else if(isMainCommand(command)) {
            fromBranch = branch.develop;
        }
    }
    
    tasks.add({
        title: 'Git fetch',
        skip : () => !options.pull,
        task : () => git.fetch([ '--all', '--tags' ])
    });
    
    if(fromTag) {
        tasks.add({
            title: 'Read package.json',
            task : ctx => {
                const TMP_BRANCH_NAME = 'temp/' + Math.random().toString(36).substr(2, 32);
                return git.currentBranch().pipe(
                    switchMap(branch => {
                        return concat(
                            git.createBranch(TMP_BRANCH_NAME, { fromTag }),
                            readPkgIntoContext(PKG_FILE, ctx),
                            git.checkout(branch),
                            git.removeBranch(TMP_BRANCH_NAME, { force: true })
                        )
                    })
                );
            }
        })
    } else if(fromCommit) {
        tasks.add({
            title: 'Read package.json',
            task : ctx => {
                const TMP_BRANCH_NAME = 'temp/' + Math.random().toString(36).substr(2, 32);
                return git.currentBranch().pipe(
                    switchMap(branch => {
                        return concat(
                            git.createBranch(TMP_BRANCH_NAME, { fromCommit }),
                            readPkgIntoContext(PKG_FILE, ctx),
                            git.checkout(branch),
                            git.removeBranch(TMP_BRANCH_NAME)
                        )
                    })
                );
            }
        })
    } else {
        if(fromBranch) {
            tasks.add({
                title: `Checkout branch ${fromBranch}`,
                task: () => git.checkout(fromBranch!)
            });
        }
        
        tasks.add({
            title: `Git pull`,
            skip: () => !options.pull,
            task: () => concat(
                invokeScript('prePull', { scripts }),
                git.pull(),
                invokeScript('postPull', { scripts })
            )
        });
        
        tasks.add({
            title: 'Read package.json',
            task: ctx => readPkgIntoContext(PKG_FILE, ctx)
        });
    }
    
    tasks.add({
        title: 'Resolve new version',
        task: (ctx, task) => git.currentBranch().pipe(map((branchName) => {
            let v : SemVer|null|undefined;
    
            const isHotfix = branchName.indexOf(prefix.hotfix) === 0;
            const isRelease = branchName.indexOf(prefix.release) === 0;
            
            if(isMainCommand(command)) {
                if(!ctx.pkg) {
                    throw new Error('ctx.pkg required');
                }
                v = semver.parse(ctx.pkg.version)!.inc(command === 'hotfix' ? 'patch' : command);
                
                if(options.type) {
                    v.prerelease = [ options.type, '0' ];
                }
            }
            
            if(isIncCommand(command) || isFinalCommand(command)) {
                if(!isHotfix && !isRelease) {
                    throw new Error('Wrong current branch');
                }
    
                if(!ctx.pkg) {
                    throw new Error('ctx.pkg required');
                }
                v = semver.parse(ctx.pkg.version)!;
                
                const branchVersion = isHotfix
                    ? branchName.substr(prefix.hotfix.length)
                    : branchName.substr(prefix.release.length);
    
                if(mainVersion(v) !== branchVersion) {
                    v = semver.parse(branchVersion)!;
                    v.prerelease = [ 'pre' ];
                }
            }
            
            if(isIncCommand(command)) {
                v = v!.inc('prerelease', command);
            }
            
            if(isFinalCommand(command) || options.oneShot) {
                v!.prerelease.length = 0;
            }
            
            if(!v) {
                throw new Error('Cannot resolve new version');
            }
            ctx.version = v;
            task.title += ` to ${ctx.version.format()}`;
        }))
    });
    
    
    if(command === 'patch' || command === 'minor' || command === 'major') {
        tasks.add({
            title: 'Git flow start release',
            task: ctx => fromTag ?
                git.createBranch( prefix.release + mainVersion(ctx.version!), { fromTag }) :
                fromCommit ? git.createBranch( prefix.release + mainVersion(ctx.version!), { fromCommit }) :
                git.createBranch( prefix.release + mainVersion(ctx.version!))
        });
    } else if(command === 'hotfix') {
        tasks.add({
            title: 'Git flow start hotfix',
            task: ctx => fromTag ?
                git.createBranch( prefix.hotfix + mainVersion(ctx.version!), { fromTag }) :
                fromCommit ? git.createBranch( prefix.hotfix + mainVersion(ctx.version!), { fromCommit }) :
                git.createBranch( prefix.hotfix + mainVersion(ctx.version!))
                
        });
    } else {
        tasks.add({
            title: 'Check current branch',
            task: () => git.currentBranch().pipe(
                switchMap(branch => {
                    const isHotfix = branch.indexOf(prefix.hotfix) === 0;
                    const isRelease = branch.indexOf(prefix.release) === 0;
    
                    if(!isHotfix && !isRelease) {
                        return _throw(new Error(`Invalid branch: "${branch}"`));
                    }
                    
                    return empty();
                })
            )
        })
    }
    
    tasks.add({
        title: 'bump version',
        skip: ctx => 0 === ctx.version!.prerelease.length && !isFinalCommand(command) && !options.oneShot,
        task: (ctx, task) => {
            ctx.pkg!.version = ctx.version!.format();
            task.title += ` to ${ctx.pkg!.version}`;
            versionTag = prefix.versiontag + ctx.version!.format();
            return concat(
                invokeScript('preBump', { scripts }, ctx),
                fromPromise(fs.writeFile(PKG_FILE, JSON.stringify(ctx.pkg, null, 2))),
                git('add', 'package.json'),
                invokeScript('bump', { scripts }, ctx),
                git.commit(options.commitMessage.replace(/%VERSION%/g, ctx.version!.format())),
                (options.oneShot || isFinalCommand(command)) && !options.tagBranch ? empty() : git.currentBranch().pipe(
                    switchMap(branchName => concat(
                        git.tag(versionTag!, branchName),
                        invokeScript('postBump', { scripts, env: { FB_BRANCH: branchName } }, ctx)
                    ))
                )
            )
        }
    });
    
    tasks.add({
        title: 'Push branch',
        skip: () => !options.push,
        task: ctx => concat(
            git.currentBranch().pipe(
                switchMap(branch => concat(
                    invokeScript('prePush', { scripts, env: { FB_BRANCH: branch } }, ctx),
                    git.push('origin', branch),
                    invokeScript('postPush', { scripts, env: { FB_BRANCH: branch } }, ctx)
                ))
            )
        )
    });
    
    if(isFinalCommand(command) || options.oneShot) {
        tasks.add({
            title: 'Git finish',
            task: (ctx, task) => git.currentBranch().pipe(
                switchMap((branchName : string) => {
                    const isHotfix = branchName.indexOf(prefix.hotfix) === 0;
                    const isRelease = branchName.indexOf(prefix.release) === 0;
                    
                    if(!isHotfix && !isRelease) {
                        return _throw(new Error(`Invalid branch: "${branchName}"`));
                    }
                    
                    versionTag = prefix.versiontag + ctx.version!.format();
                    
                    if(options.toBranch === 'master' || !options.toBranch) {
                        return concat(
                            git.checkout(branch.master),
                            git.merge(branchName, [ '--no-edit' ]).pipe(handleConflictError(task)),
                            options.tagBranch ? empty() : git.tag(versionTag!, branch.master),
                            git.checkout(branch.develop),
                            git.merge(branchName, [ '--no-edit', '--no-ff' ]).pipe(handleConflictError(task)),
                            options.keepBranch ? empty() : git.removeBranch(branchName)
                        );
                    } else {
                        return concat(
                            git.checkoutOrCreate(prefix.support + options.toBranch),
                            git.merge(branchName, [ '--no-edit' ]).pipe(handleConflictError(task)),
                            options.tagBranch ? empty() : git.tag(versionTag!, branch.master),
                            options.keepBranch ? empty() : git.removeBranch(branchName)
                        )
                    }
                })
            )
        });
    
        if(options.toBranch === 'master' || !options.toBranch) {
            tasks.add({
                title: 'Push develop branch',
                skip : () => !options.push,
                task : ctx => concat(
                    git.checkout(branch.develop),
                    invokeScript('prePush', { scripts, env: { FB_BRANCH: branch.develop } }, ctx),
                    git.push('origin', branch.develop),
                    invokeScript('postPush', { scripts, env: { FB_BRANCH: branch.develop } }, ctx)
                )
            });
    
            tasks.add({
                title: `Push master branch`,
                skip : () => !options.push,
                task : ctx => concat(
                    git.checkout(branch.master),
                    invokeScript('prePush', { scripts, env: { FB_BRANCH: branch.master } }, ctx),
                    git.push('origin', branch.master),
                    invokeScript('postPush', { scripts, env: { FB_BRANCH: branch.master } }, ctx),
                )
            });
        } else {
            tasks.add({
                title: `Push support branch`,
                skip : () => !options.push,
                task : ctx => concat(
                    git.checkout(prefix.support + options.toBranch),
                    invokeScript('prePush', { scripts, env: { FB_BRANCH: prefix.support + options.toBranch } }, ctx),
                    git.push('origin', prefix.support + options.toBranch),
                    invokeScript('postPush', { scripts, env: { FB_BRANCH: prefix.support + options.toBranch } }, ctx),
                )
            });
        }
        
        tasks.add({
            title: 'Push tag',
            skip: () => !options.push || !versionTag,
            task: () => git.pushTag('origin', versionTag!)
        });
    }
    
    return await tasks.run();
}

process.on('unhandledRejection', (reason) => {
    console.log('unhandledRejection: ' + reason.stack);
});
