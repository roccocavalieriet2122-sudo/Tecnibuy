# Chat service - placeholder for Phase 3
# Will be implemented in Phase 3

from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.chat import Conversation, Message
from app.models.user import User


def get_or_create_conversation(db: Session, user_a_id: int, user_b_id: int) -> Conversation:
    """Get existing conversation or create new one between two users."""
    # Ensure consistent ordering
    if user_a_id > user_b_id:
        user_a_id, user_b_id = user_b_id, user_a_id

    conv = (
        db.query(Conversation)
        .filter(Conversation.user_a_id == user_a_id, Conversation.user_b_id == user_b_id)
        .first()
    )

    if not conv:
        conv = Conversation(user_a_id=user_a_id, user_b_id=user_b_id)
        db.add(conv)
        db.commit()
        db.refresh(conv)

    return conv


def get_user_conversations(db: Session, user_id: int) -> List[Conversation]:
    """Get all conversations for a user."""
    return (
        db.query(Conversation)
        .filter((Conversation.user_a_id == user_id) | (Conversation.user_b_id == user_id))
        .order_by(Conversation.last_activity.desc())
        .all()
    )


def get_conversation_messages(
    db: Session, conversation_id: int, user_id: int, limit: int = 50, offset: int = 0
) -> List[Message]:
    """Get messages for a conversation (user must be participant)."""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        return []

    if conv.user_a_id != user_id and conv.user_b_id != user_id:
        return []

    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )


def send_message(
    db: Session,
    conversation_id: int,
    sender_id: int,
    recipient_id: int,
    ciphertext: bytes,
    nonce: bytes,
    sender_pubkey_ref: str,
    meta_hash: str,
) -> Message:
    """Store an encrypted message."""
    msg = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        recipient_id=recipient_id,
        ciphertext=ciphertext,
        nonce=nonce,
        sender_pubkey_ref=sender_pubkey_ref,
        meta_hash=meta_hash,
    )
    db.add(msg)

    # Update conversation last_activity
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conv:
        from datetime import datetime, timezone
        conv.last_activity = datetime.now(timezone.utc)

    db.commit()
    db.refresh(msg)
    return msg


def get_user_pubkey(db: Session, user_id: int) -> Optional[bytes]:
    """Get user's public key for E2E encryption."""
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.pubkey:
        return user.pubkey
    return None