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
