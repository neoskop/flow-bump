export interface IOptions {
    commitMessage: string;
    pull: boolean;
    push: boolean;
    keepBranch: boolean;
    tagBranch: boolean;
}

export interface IPrefix {
    release: string;
    hotfix: string;
    versiontag: string;
}

export interface IBranch {
    master: string;
    develop: string;
}


export interface IScripts {
    prePull?: string|string[];
    postPull?: string|string[];
    prePush?: string|string[];
    postPush?: string|string[];
    preBump?: string|string[];
    bump?: string|string[];
    postBump?: string|string[];
}

export type Hooks = keyof IScripts;
