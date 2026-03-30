export type ProjectStatus = "Active";

export type Project = {
  id: string; // slug used for routing
  name: string;
  description: string;
  status: ProjectStatus;

  // Demo metrics (to replace with real backend data later)
  models: number;
  inferencesToday: string;
  updatedText: string;

  createdAt: number;
};

export type ProjectFormState = {
  name: string;
  description: string;
};