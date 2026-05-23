/**
 * 数据访问层 - Project CRUD（Task 3 + Task 7）
 */

import { getDb } from "./database";

export interface ProjectRow {
  project_id: string;
  name: string;
  created_at: number;
}

/** 创建项目 */
export function createProject(projectId: string, name: string): void {
  const db = getDb();
  db.prepare("INSERT INTO projects (project_id, name, created_at) VALUES (?, ?, ?)").run(projectId, name, Date.now());
}

/** 查询所有项目 */
export function getAllProjects(): ProjectRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM projects ORDER BY created_at ASC").all() as ProjectRow[];
}

/** 按名称查找项目 */
export function getProjectByName(name: string): ProjectRow | null {
  const db = getDb();
  return db.prepare("SELECT * FROM projects WHERE name = ?").get(name) as ProjectRow | null;
}

/** 删除项目 */
export function deleteProject(projectId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM projects WHERE project_id = ?").run(projectId);
}
