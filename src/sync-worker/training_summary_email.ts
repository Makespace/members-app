import { SyncWorkerDependencies } from "./dependencies";

// Temporary
const TRAINING_SUMMARY_EMAIL_ALLOWLIST: number[] = [1741, 131, 1698, 1725];

export const trainingSummaryEmail = async (deps: Pick<SyncWorkerDependencies, 'sendEmail' | 'sharedReadModel' | 'logger' | 'commitEvent'>) => {
    const allOwners = deps.sharedReadModel.area.getAll().flatMap(a => a.owners);
    

};
