from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone
import base64

from app.database import get_db
from app.schemas.chat import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
    PubkeyResponse,
    UserMinimal,
    MessageMinimal,
)
from app.api.deps import get_current_user_id
from app.models.user import User
from app.services import chat_store

router = APIRouter(prefix="/conversations", tags=["chat"])


def _parse_dt(value) -> datetime:
    """Los timestamps se guardan como ISO string en el JSON."""
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(value)


def _find_conversation(data, conversation_id: int, user_id: int):
    for conv in data["conversations"]:
        if conv["id"] == conversation_id and user_id in (conv["user_a_id"], conv["user_b_id"]):
            return conv
    return None


@router.get("", response_model=List[ConversationResponse])
def list_conversations(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """List all conversations for current user."""
    data = chat_store.load()

    conversations = [
        c for c in data["conversations"]
        if user_id in (c["user_a_id"], c["user_b_id"])
    ]
    conversations.sort(key=lambda c: _parse_dt(c["last_activity"]), reverse=True)

    result = []
    for conv in conversations:
        other_id = conv["user_b_id"] if conv["user_a_id"] == user_id else conv["user_a_id"]
        other_user = db.query(User).filter(User.id == other_id).first()
        if not other_user or not other_user.is_active:
            continue

        conv_messages = [m for m in data["messages"] if m["conversation_id"] == conv["id"]]
        conv_messages.sort(key=lambda m: _parse_dt(m["created_at"]))

        last_msg = conv_messages[-1] if conv_messages else None

        # Cuenta simple de mensajes del otro usuario (igual que antes)
        unread = sum(1 for m in conv_messages if m["sender_id"] == other_id)

        last_message = None
        if last_msg:
            last_message = MessageMinimal(
                id=last_msg["id"],
                sender_id=last_msg["sender_id"],
                text=last_msg["text"],
                created_at=_parse_dt(last_msg["created_at"]),
            )

        result.append(ConversationResponse(
            id=conv["id"],
            other_user=UserMinimal(
                id=other_user.id,
                username=other_user.username,
                avatar=other_user.avatar,
            ),
            last_message=last_message,
            last_activity=_parse_dt(conv["last_activity"]),
            unread_count=unread,
        ))

    return result


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_or_get_conversation(
    data_in: ConversationCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create a new conversation or get existing one with another user."""
    other_id = data_in.other_user_id

    if other_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot create conversation with yourself")

    other_user = db.query(User).filter(User.id == other_id, User.is_active).first()
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")

    data = chat_store.load()

    conv = None
    for c in data["conversations"]:
        if {c["user_a_id"], c["user_b_id"]} == {user_id, other_id}:
            conv = c
            break

    if not conv:
        now = datetime.now(timezone.utc).isoformat()
        conv = {
            "id": chat_store.next_conversation_id(data),
            "user_a_id": min(user_id, other_id),
            "user_b_id": max(user_id, other_id),
            "created_at": now,
            "last_activity": now,
        }
        data["conversations"].append(conv)
        chat_store.save(data)

    conv_messages = [m for m in data["messages"] if m["conversation_id"] == conv["id"]]
    conv_messages.sort(key=lambda m: _parse_dt(m["created_at"]))
    last_msg = conv_messages[-1] if conv_messages else None
    unread = sum(1 for m in conv_messages if m["sender_id"] == other_id)

    last_message = None
    if last_msg:
        last_message = MessageMinimal(
            id=last_msg["id"],
            sender_id=last_msg["sender_id"],
            text=last_msg["text"],
            created_at=_parse_dt(last_msg["created_at"]),
        )

    return ConversationResponse(
        id=conv["id"],
        other_user=UserMinimal(
            id=other_user.id,
            username=other_user.username,
            avatar=other_user.avatar,
        ),
        last_message=last_message,
        last_activity=_parse_dt(conv["last_activity"]),
        unread_count=unread,
    )


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
def get_messages(
    conversation_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get messages for a conversation (paginated, newest first internally, returned oldest first)."""
    data = chat_store.load()

    conv = _find_conversation(data, conversation_id, user_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = [m for m in data["messages"] if m["conversation_id"] == conversation_id]
    messages.sort(key=lambda m: _parse_dt(m["created_at"]), reverse=True)

    offset = (page - 1) * page_size
    page_messages = messages[offset:offset + page_size]

    return [
        MessageResponse(
            id=msg["id"],
            conversation_id=msg["conversation_id"],
            sender_id=msg["sender_id"],
            recipient_id=msg["recipient_id"],
            text=msg["text"],
            created_at=_parse_dt(msg["created_at"]),
        )
        for msg in reversed(page_messages)  # Return oldest first for display
    ]


@router.post("/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    conversation_id: int,
    data_in: MessageCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Send a message in a conversation."""
    data = chat_store.load()

    conv = _find_conversation(data, conversation_id, user_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Determine recipient
    recipient_id = conv["user_b_id"] if conv["user_a_id"] == user_id else conv["user_a_id"]

    # Verify recipient matches
    if data_in.recipient_id != recipient_id:
        raise HTTPException(status_code=400, detail="Invalid recipient")

    text = data_in.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message text cannot be empty")

    now = datetime.now(timezone.utc).isoformat()
    message = {
        "id": chat_store.next_message_id(data),
        "conversation_id": conversation_id,
        "sender_id": user_id,
        "recipient_id": recipient_id,
        "text": text,
        "created_at": now,
    }
    data["messages"].append(message)

    # Update conversation last_activity
    conv["last_activity"] = now

    chat_store.save(data)

    return MessageResponse(
        id=message["id"],
        conversation_id=message["conversation_id"],
        sender_id=message["sender_id"],
        recipient_id=message["recipient_id"],
        text=message["text"],
        created_at=_parse_dt(message["created_at"]),
    )


@router.get("/users/{target_user_id}/pubkey", response_model=PubkeyResponse)
def get_user_pubkey(
    target_user_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get another user's public key for E2E encryption.

    Ya no se usa desde el frontend (el chat quedó en texto plano), pero se
    deja la ruta para no tocar la tabla `users.pubkey`.
    """
    target = db.query(User).filter(User.id == target_user_id, User.is_active).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if not target.pubkey:
        raise HTTPException(status_code=404, detail="User has no public key configured")

    return PubkeyResponse(
        user_id=target.id,
        pubkey=base64.b64encode(target.pubkey).decode(),
    )
