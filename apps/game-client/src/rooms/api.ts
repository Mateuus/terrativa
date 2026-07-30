import type {
  CreateRoomRequest,
  JoinRoomRequest,
  RoomDetails,
  RoomEntryResponse,
  RoomSummary,
} from "@terrativa/protocol";
import { authenticatedRequest } from "../auth/api";

export async function listRooms(): Promise<readonly RoomSummary[]> {
  const response = await authenticatedRequest<{ rooms: RoomSummary[] }>("/api/v1/rooms");
  return response.rooms;
}

export function createRoom(input: CreateRoomRequest): Promise<RoomEntryResponse> {
  return authenticatedRequest("/api/v1/rooms", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function joinRoom(code: string, input: JoinRoomRequest): Promise<RoomEntryResponse> {
  return authenticatedRequest(`/api/v1/rooms/${encodeURIComponent(code)}/join`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function leaveRoom(code: string): Promise<RoomDetails> {
  return authenticatedRequest(`/api/v1/rooms/${encodeURIComponent(code)}/leave`, {
    method: "POST",
    body: "{}",
  });
}
