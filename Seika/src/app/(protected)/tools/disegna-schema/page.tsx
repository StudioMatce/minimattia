import { getProjects, createProject, renameProject, deleteProject } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus } from "lucide-react";
import { ProjectCard } from "@/components/projects/ProjectCard";

export default async function DisegnaSchemaPage() {
  const projectList = await getProjects();

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Disegna schema</h2>
          <p className="text-sm text-muted-foreground">
            Disegna uno schema e ottieni un diagramma professionale
          </p>
        </div>
        <form action={async () => {
          "use server";
          await createProject("Nuovo progetto");
        }}>
          <Button type="submit" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Nuovo progetto
          </Button>
        </form>
      </div>

      {projectList.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nessun progetto</CardTitle>
            <CardDescription>
              Crea il tuo primo progetto per iniziare a disegnare
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectList.map((project) => (
            <ProjectCard
              key={project.id}
              project={{
                id: project.id,
                name: project.name,
                updatedAt: project.updatedAt.toISOString(),
              }}
              toolSlug="disegna-schema"
              onRename={renameProject}
              onDelete={deleteProject}
            />
          ))}
        </div>
      )}
    </div>
  );
}
