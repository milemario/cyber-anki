import { requireChatGPTUser } from '../chatgpt-auth';
import AdminApp from './admin-app';
export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  await requireChatGPTUser('/admin');
  return <AdminApp />;
}
