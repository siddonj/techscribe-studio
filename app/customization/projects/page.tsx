"use client";

import { useState } from "react";
import { FolderKanban, Plus, Trash2 } from "lucide-react";
import { PageHeader, SectionCard, EmptyState } from "@/components/DashboardPrimitives";

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      createdAt: new Date().toISOString(),
    };
    setProjects((prev) => [newProject, ...prev]);
    setName("");
    setDescription("");
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const inputClassName =
    "shell-input w-full rounded-2xl px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors";

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-5 md:p-8 max-w-5xl w-full mx-auto space-y-6">
        <PageHeader
          eyebrow="Customization"
          title="Projects"
          description="Organize your content work into projects. Each project can hold its own context, tone settings, and knowledge sources."
          backHref="/"
          backLabel="Back to dashboard"
          icon={<FolderKanban className="h-8 w-8 text-accent" />}
          actions={
            <button
              onClick={() => setShowForm((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-2xl bg-accent text-white px-5 py-3 text-sm font-semibold hover:bg-accent-dim transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Project
            </button>
          }
        />

        {showForm && (
          <SectionCard className="space-y-4">
            <p className="font-mono text-xs text-slate-500 uppercase tracking-wider">New Project</p>
            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Project Name
              </label>
              <input
                type="text"
                className={inputClassName}
                value={name}
                placeholder="e.g. Company Blog Q3"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea
                className={`${inputClassName} resize-none`}
                value={description}
                placeholder="What is this project about?"
                rows={3}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="bg-accent text-white font-semibold px-5 py-3 rounded-2xl text-sm hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Project
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setName("");
                  setDescription("");
                }}
                className="border border-white/10 text-slate-300 font-semibold px-5 py-3 rounded-2xl text-sm hover:text-white hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </SectionCard>
        )}

        {projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban />}
            eyebrow="No projects yet"
            description="Create your first project to organize content, tone settings, and knowledge sources in one place."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <SectionCard key={project.id} className="flex flex-col gap-3 relative group">
                <div className="flex items-start justify-between gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                    <FolderKanban className="h-5 w-5 text-accent" />
                  </div>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/10"
                    aria-label="Delete project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  <p className="text-white font-medium text-base">{project.name}</p>
                  {project.description && (
                    <p className="text-slate-400 text-sm mt-1 leading-relaxed line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-mono mt-auto pt-2 border-t border-white/5">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </SectionCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
