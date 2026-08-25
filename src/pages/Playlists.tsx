import React, { useEffect, useState } from "react";
import {
  Typography,
  Card,
  Button,
  List,
  Modal,
  Input,
  Popconfirm,
  Spin,
  message,
  Empty,
  Tag,
  Drawer,
} from "antd";
import {
  FolderOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  BookOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  getAllPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  getPlaylistById,
  removePostFromPlaylist,
} from "../services/blogApi";
import type { BlogPlaylist, BlogPost } from "../types/blog";

const { Title, Text, Paragraph } = Typography;

const Playlists: React.FC = () => {
  const navigate = useNavigate();

  const [playlists, setPlaylists] = useState<BlogPlaylist[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Playlist Drawer State
  const [selectedPlaylist, setSelectedPlaylist] = useState<BlogPlaylist | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Create / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<BlogPlaylist | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const data = await getAllPlaylists();
      setPlaylists(data);
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.message || "Please login to view your playlists.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingPlaylist(null);
    setTitle("");
    setDesc("");
    setModalOpen(true);
  };

  const handleOpenEditModal = (e: React.MouseEvent, playlist: BlogPlaylist) => {
    e.stopPropagation();
    setEditingPlaylist(playlist);
    setTitle(playlist.title);
    setDesc(playlist.description || "");
    setModalOpen(true);
  };

  const handleSavePlaylist = async () => {
    if (!title.trim()) {
      message.warning("Please enter a playlist title.");
      return;
    }
    setSaving(true);
    try {
      if (editingPlaylist) {
        await updatePlaylist(editingPlaylist.id, title, desc);
        message.success("Playlist updated!");
      } else {
        await createPlaylist(title, desc);
        message.success("Playlist created!");
      }
      setModalOpen(false);
      fetchPlaylists();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to save playlist.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlaylist = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deletePlaylist(id);
      message.success("Playlist deleted.");
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      if (selectedPlaylist?.id === id) {
        setDrawerOpen(false);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to delete playlist.");
    }
  };

  const handleViewPlaylistDetails = async (id: string) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const details = await getPlaylistById(id);
      setSelectedPlaylist(details);
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to load playlist details.");
      setDrawerOpen(false);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleRemovePostFromCurrentPlaylist = async (postId: string) => {
    if (!selectedPlaylist) return;
    try {
      const updated = await removePostFromPlaylist(selectedPlaylist.id, postId);
      message.success("Post removed from playlist.");
      setSelectedPlaylist(updated);
      fetchPlaylists();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to remove post.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} className="m-0! font-black! text-slate-900! dark:text-white!">
            Saved Playlists & Collections
          </Title>
          <Text className="text-slate-500 dark:text-slate-400 text-xs font-medium">
            Organize study notes, system design guides, and interview articles into custom playlists.
          </Text>
        </div>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreateModal}
          className="h-11 px-6 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-500 shadow-md"
        >
          New Playlist
        </Button>
      </div>

      {/* Playlists Grid */}
      {loading ? (
        <div className="py-16 text-center">
          <Spin size="large" />
          <Text className="block mt-4 text-slate-500">Loading playlists...</Text>
        </div>
      ) : playlists.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <Empty
            description={
              <Text className="text-slate-500 dark:text-slate-400 font-medium">
                No custom playlists created yet.
              </Text>
            }
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreateModal}
              className="rounded-xl bg-indigo-600 font-bold"
            >
              Create Playlist
            </Button>
          </Empty>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map((playlist) => (
            <Card
              key={playlist.id}
              hoverable
              onClick={() => handleViewPlaylistDetails(playlist.id)}
              className="rounded-3xl border-slate-200/80 dark:border-slate-800 dark:bg-slate-900 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xl font-bold group-hover:scale-110 transition-transform">
                    <FolderOutlined />
                  </div>
                  <div>
                    <Title level={5} className="m-0! font-bold! text-slate-900! dark:text-white!">
                      {playlist.title}
                    </Title>
                    <Text className="text-[10px] text-slate-400">
                      Created {new Date(playlist.created_at).toLocaleDateString()}
                    </Text>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => handleOpenEditModal(e, playlist)}
                    className="text-slate-400 hover:text-indigo-600"
                  />
                  <Popconfirm
                    title="Delete Playlist"
                    description="Delete this playlist?"
                    onConfirm={(e) => handleDeletePlaylist(e as any, playlist.id)}
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                      className="text-rose-400 hover:text-rose-600"
                    />
                  </Popconfirm>
                </div>
              </div>

              <Paragraph className="text-slate-500 dark:text-slate-400 text-xs line-clamp-2 min-h-[32px]">
                {playlist.description || "No description provided."}
              </Paragraph>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-2">
                <Tag color="indigo" className="rounded-full px-2.5 py-0.5 text-[10px] font-bold border-none">
                  <BookOutlined className="mr-1" /> {playlist.postCount || playlist.posts?.length || 0} Articles
                </Tag>

                <Text className="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  View <FolderOpenOutlined />
                </Text>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Playlist Content Drawer */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <FolderOpenOutlined className="text-indigo-600 dark:text-indigo-400" />
            <span className="font-black text-slate-900 dark:text-white text-lg">
              {selectedPlaylist?.title || "Playlist Details"}
            </span>
          </div>
        }
        placement="right"
        width={600}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        className="dark:bg-slate-900"
      >
        {drawerLoading ? (
          <div className="py-20 text-center">
            <Spin size="large" />
          </div>
        ) : selectedPlaylist ? (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-slate-800/50 border border-indigo-100 dark:border-slate-700">
              <Paragraph className="text-slate-600 dark:text-slate-300 text-xs m-0">
                {selectedPlaylist.description || "No description provided."}
              </Paragraph>
              <Text className="block mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {selectedPlaylist.posts?.length || 0} Saved Posts
              </Text>
            </div>

            <List
              dataSource={selectedPlaylist.posts || []}
              locale={{ emptyText: "No posts saved in this playlist yet." }}
              renderItem={(post: BlogPost) => (
                <Card
                  key={post.id}
                  hoverable
                  onClick={() => {
                    setDrawerOpen(false);
                    navigate(`/blog/${post.id}`);
                  }}
                  className="mb-3 rounded-2xl border-slate-200/80 dark:border-slate-800 dark:bg-slate-800/40 p-1"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Title level={5} className="m-0! font-bold! text-slate-900! dark:text-white! line-clamp-1">
                        {post.title}
                      </Title>
                      <Paragraph className="text-slate-500 dark:text-slate-400 text-xs m-0! line-clamp-2">
                        {post.content}
                      </Paragraph>
                    </div>

                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePostFromCurrentPlaylist(post.id);
                      }}
                      className="rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              )}
            />
          </div>
        ) : null}
      </Drawer>

      {/* Create / Edit Modal */}
      <Modal
        title={
          <span className="text-xl font-black text-slate-900 dark:text-white">
            {editingPlaylist ? "Edit Playlist" : "Create New Playlist"}
          </span>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSavePlaylist}
        confirmLoading={saving}
        okText={editingPlaylist ? "Save Changes" : "Create Playlist"}
        okButtonProps={{ className: "bg-indigo-600 font-bold rounded-xl" }}
        cancelButtonProps={{ className: "rounded-xl font-semibold" }}
        className="dark:bg-slate-900"
      >
        <div className="py-4 space-y-4">
          <div>
            <Text className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
              Title
            </Text>
            <Input
              placeholder="e.g. System Design Interview Guides"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl h-11"
            />
          </div>

          <div>
            <Text className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
              Description (Optional)
            </Text>
            <Input.TextArea
              placeholder="e.g. A collection of key notes for distributed systems..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              className="rounded-xl"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Playlists;
