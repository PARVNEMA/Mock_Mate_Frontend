import React, { useState, useEffect } from "react";
import { Modal, Button, Input, List, message, Spin, Typography } from "antd";
import { PlusOutlined, FolderAddOutlined, CheckCircleFilled } from "@ant-design/icons";
import {
  getAllPlaylists,
  createPlaylist,
  addPostToPlaylist,
  removePostFromPlaylist,
} from "../services/blogApi";
import type { BlogPlaylist } from "../types/blog";

const { Text } = Typography;

interface AddToPlaylistModalProps {
  open: boolean;
  postId: string | null;
  onClose: () => void;
}

const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  open,
  postId,
  onClose,
}) => {
  const [playlists, setPlaylists] = useState<BlogPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const data = await getAllPlaylists();
      setPlaylists(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && postId) {
      fetchPlaylists();
      setCreating(false);
      setNewTitle("");
      setNewDesc("");
    }
  }, [open, postId]);

  const handleCreatePlaylist = async () => {
    if (!newTitle.trim()) {
      message.warning("Please enter a playlist title.");
      return;
    }
    try {
      const playlist = await createPlaylist(newTitle, newDesc);
      message.success(`Playlist "${playlist.title}" created!`);
      setNewTitle("");
      setNewDesc("");
      setCreating(false);
      if (postId) {
        await addPostToPlaylist(playlist.id, postId);
        message.success("Post added to new playlist!");
      }
      fetchPlaylists();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to create playlist.");
    }
  };

  const handleTogglePostInPlaylist = async (playlist: BlogPlaylist) => {
    if (!postId) return;
    setAddingId(playlist.id);

    const isAlreadyIn = playlist.posts?.some((p) => p.id === postId);

    try {
      if (isAlreadyIn) {
        await removePostFromPlaylist(playlist.id, postId);
        message.info(`Removed from "${playlist.title}"`);
      } else {
        await addPostToPlaylist(playlist.id, postId);
        message.success(`Saved to "${playlist.title}"`);
      }
      fetchPlaylists();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Action failed.");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Modal
      title={
        <span className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <FolderAddOutlined className="text-indigo-600 dark:text-indigo-400" /> Save Post to Playlist
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose} className="rounded-xl font-bold">
          Done
        </Button>,
      ]}
      className="dark:bg-slate-900"
    >
      <div className="py-2 space-y-4">
        {!creating ? (
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() => setCreating(true)}
            className="h-11 rounded-xl border-indigo-400 text-indigo-600 dark:text-indigo-400 font-bold"
          >
            Create New Playlist
          </Button>
        ) : (
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-3 border border-indigo-100 dark:border-slate-700">
            <Text className="font-bold text-xs uppercase tracking-wider text-slate-500">
              New Playlist Details
            </Text>
            <Input
              placeholder="Playlist Title (e.g. System Design Prep)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="rounded-xl"
            />
            <Input.TextArea
              placeholder="Description (Optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              className="rounded-xl"
            />
            <div className="flex justify-end gap-2">
              <Button onClick={() => setCreating(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={handleCreatePlaylist}
                className="rounded-xl bg-indigo-600 font-bold"
              >
                Save & Add Post
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center">
            <Spin />
          </div>
        ) : (
          <List
            dataSource={playlists}
            locale={{ emptyText: "No playlists found. Create one above!" }}
            renderItem={(playlist) => {
              const isInPlaylist = playlist.posts?.some((p) => p.id === postId);
              const isProcessing = addingId === playlist.id;

              return (
                <List.Item
                  actions={[
                    <Button
                      key="add-remove"
                      type={isInPlaylist ? "default" : "primary"}
                      loading={isProcessing}
                      onClick={() => handleTogglePostInPlaylist(playlist)}
                      className={`rounded-xl font-bold ${
                        isInPlaylist
                          ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-indigo-600"
                      }`}
                    >
                      {isInPlaylist ? (
                        <>
                          <CheckCircleFilled className="text-emerald-500" /> Saved
                        </>
                      ) : (
                        "Save"
                      )}
                    </Button>,
                  ]}
                  className="rounded-2xl border border-slate-100 dark:border-slate-800 p-3 mb-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <List.Item.Meta
                    title={
                      <span className="font-bold text-slate-900 dark:text-white text-base">
                        {playlist.title}
                      </span>
                    }
                    description={
                      <Text className="text-xs text-slate-500 dark:text-slate-400">
                        {playlist.description || "No description"} • {playlist.postCount || playlist.posts?.length || 0} items
                      </Text>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </Modal>
  );
};

export default AddToPlaylistModal;
