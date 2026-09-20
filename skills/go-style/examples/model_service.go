// Package styleexample demonstrates explicit dependencies and phased business logic.
// It contains no HTTP routes or production persistence implementation.
package styleexample

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

type ModelStatus string

const (
	ModelStatusActive  ModelStatus = "active"
	ModelStatusDeleted ModelStatus = "deleted"
)

var (
	ErrInvalidArgument = errors.New("invalid model argument")
	ErrNotFound        = errors.New("model not found")
	ErrConflict        = errors.New("model version conflict")
)

type Model struct {
	ID          int64
	DisplayName string
	Enabled     bool
	Status      ModelStatus
	Version     int64
}

type ModelPatch struct {
	DisplayName *string
	Enabled     *bool
}

type ModelView struct {
	ID          int64
	DisplayName string
	Enabled     bool
	Version     int64
}

// ModelStore is defined at the consumer boundary and exposes only its needs.
type ModelStore interface {
	Get(ctx context.Context, id int64) (*Model, error)

	// Update must atomically check the expected version before applying the patch.
	// A prior Get cannot prevent a concurrent update between the two operations.
	Update(ctx context.Context, id, expectedVersion int64, patch ModelPatch) (*Model, error)
}

type ModelService struct {
	store ModelStore
}

func NewModelService(store ModelStore) *ModelService {
	return &ModelService{store: store}
}

// Update is the domain operation after caller authorization.
// An omitted field preserves the stored value; an explicit false disables the model.
func (s *ModelService) Update(
	ctx context.Context,
	id, expectedVersion int64,
	patch ModelPatch,
) (*ModelView, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if id <= 0 || expectedVersion <= 0 {
		return nil, fmt.Errorf("model id and version must be positive: %w", ErrInvalidArgument)
	}
	if patch.DisplayName != nil {
		name := strings.TrimSpace(*patch.DisplayName)
		if name == "" {
			return nil, fmt.Errorf("model display name is required: %w", ErrInvalidArgument)
		}
		patch.DisplayName = &name
	}

	current, err := s.store.Get(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("load model %d: %w", id, err)
	}

	if current.Status != ModelStatusActive {
		return nil, ErrNotFound
	}
	if current.Version != expectedVersion {
		return nil, ErrConflict
	}

	updated, err := s.store.Update(ctx, id, expectedVersion, patch)
	if err != nil {
		return nil, fmt.Errorf("update model %d: %w", id, err)
	}

	return modelView(updated), nil
}

func modelView(model *Model) *ModelView {
	return &ModelView{
		ID:          model.ID,
		DisplayName: model.DisplayName,
		Enabled:     model.Enabled,
		Version:     model.Version,
	}
}
