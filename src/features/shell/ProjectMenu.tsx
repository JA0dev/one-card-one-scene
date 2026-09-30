// 작품 이름을 누르면 여는 메뉴: 작품 바꾸기, 새 작품, 이름 고치기, 삭제.
import { useState } from 'react';
import { BookCopy, Check, ChevronDown, PencilLine, Plus, Sparkles, Trash2 } from 'lucide-react';
import { createProject, deleteProject, openProject } from '@/state/actions';
import { ui, useProject, useRepo } from '@/state/app';
import { Confirm, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/ui/kit';
import { activeScenes } from '@/domain/scenes';
import { josa, quote } from '@/domain/text';

export function ProjectMenu() {
  const { projects } = useRepo();
  const project = useProject();
  const [confirm, setConfirm] = useState(false);
  if (!project) return null;
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" className="project-btn" aria-label={`작품: ${project.title}. 작품 메뉴 열기`}>
            <span className="project-title">{project.title || '제목 없는 이야기'}</span>
            <ChevronDown size={16} />
          </button>
        </MenuTrigger>
        <MenuContent align="start" className="project-menu">
          <MenuLabel>내 작품</MenuLabel>
          {projects.map((p) => (
            <MenuItem key={p.id} onSelect={() => openProject(p.id)} icon={p.id === project.id ? <Check size={15} /> : <BookCopy size={15} />} hint={`${activeScenes(p).length}장`}>
              {p.title || '제목 없는 이야기'}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem icon={<Plus size={15} />} onSelect={() => createProject()}>새 작품</MenuItem>
          <MenuItem icon={<Sparkles size={15} />} onSelect={() => createProject(true)}>예시 작품 열기</MenuItem>
          <MenuSeparator />
          <MenuItem icon={<PencilLine size={15} />} onSelect={() => ui.set({ dialog: { kind: 'project' } })}>작품 이름 바꾸기</MenuItem>
          <MenuItem icon={<Trash2 size={15} />} danger onSelect={() => setConfirm(true)}>작품 삭제</MenuItem>
        </MenuContent>
      </Menu>
      <Confirm open={confirm} onOpenChange={setConfirm} title="작품을 삭제할까요?"
        description={<>{quote(project.title, '작품')}{josa(project.title || '작품', '과/와')} 모든 카드가 지워져요. 이 기기의 복구 사본에는 남아요.</>}
        confirm="작품 삭제" onConfirm={() => void deleteProject(project.id)} />
    </>
  );
}
