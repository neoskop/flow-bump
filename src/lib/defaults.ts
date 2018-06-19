import { IBranch, IOptions, IPrefix } from '../types';

export const DEFAULT_OPTIONS : IOptions = {
    pull: true,
    push: true,
    commitMessage: 'Bump to version %VERSION%',
    keepBranch: false,
    tagBranch: false
};

export const DEFAULT_BRANCH : IBranch = {
    develop: 'develop',
    master: 'master'
};

export const DEFAULT_PREFIX : IPrefix = {
    release: 'release/',
    hotfix: 'hotfix/',
    support: 'support/',
    versiontag: ''
};
