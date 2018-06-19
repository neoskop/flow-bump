export type MainCommand = 'major'|'minor'|'patch'|'hotfix';
export type IncCommand = 'alpha'|'beta'|'rc';
export type FinalCommand = 'final';
export type Command = MainCommand|IncCommand|FinalCommand;

export const MAIN_RELEASE_COMMANDS : MainCommand[] = [ 'major', 'minor', 'patch', 'hotfix' ];
export const INC_RELEASE_COMMANDS : IncCommand[] = [ 'rc', 'beta', 'alpha' ];
export const FINAL_RELEASE_COMMANDS : FinalCommand[] = [ 'final' ];

export function isMainCommand(cmd : any) : cmd is MainCommand {
    return MAIN_RELEASE_COMMANDS.includes(cmd);
}

export function isIncCommand(cmd : any) : cmd is IncCommand {
    return INC_RELEASE_COMMANDS.includes(cmd);
}

export function isFinalCommand(cmd : any) : cmd is FinalCommand {
    return FINAL_RELEASE_COMMANDS.includes(cmd);
}
