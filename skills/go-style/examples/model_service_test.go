package styleexample

import (
	"context"
	"errors"
	"testing"
)

func TestUpdatePreservesOmittedFieldsAndAppliesFalse(t *testing.T) {
	store := newTestStore()
	service := NewModelService(store)
	disabled := false

	view, err := service.Update(context.Background(), 1, 3, ModelPatch{Enabled: &disabled})
	if err != nil {
		t.Fatal(err)
	}
	if view.Enabled || view.DisplayName != "weather" || view.Version != 4 {
		t.Fatalf("unexpected view: %+v", view)
	}

	name := "  travel  "
	view, err = service.Update(context.Background(), 1, 4, ModelPatch{DisplayName: &name})
	if err != nil {
		t.Fatal(err)
	}
	if view.Enabled || view.DisplayName != "travel" || name != "  travel  " {
		t.Fatalf("update lost presence semantics or changed input: %+v", view)
	}
}

func TestUpdateDoesNotPersistInvalidInput(t *testing.T) {
	store := newTestStore()
	name := " "
	_, err := NewModelService(store).Update(context.Background(), 1, 3, ModelPatch{DisplayName: &name})
	if !errors.Is(err, ErrInvalidArgument) || store.updates != 0 {
		t.Fatalf("error = %v, updates = %d", err, store.updates)
	}
}

func TestUpdateRejectsStaleVersion(t *testing.T) {
	store := newTestStore()
	_, err := NewModelService(store).Update(context.Background(), 1, 2, ModelPatch{})
	if !errors.Is(err, ErrConflict) || store.updates != 0 {
		t.Fatalf("error = %v, updates = %d", err, store.updates)
	}
}

func TestUpdatePreservesConcurrentConflict(t *testing.T) {
	store := newTestStore()
	store.updateError = ErrConflict
	_, err := NewModelService(store).Update(context.Background(), 1, 3, ModelPatch{})
	if !errors.Is(err, ErrConflict) || store.model.Version != 3 {
		t.Fatalf("error = %v, version = %d", err, store.model.Version)
	}
}

func TestUpdatePreservesStorageError(t *testing.T) {
	store := newTestStore()
	want := errors.New("storage unavailable")
	store.updateError = want
	_, err := NewModelService(store).Update(context.Background(), 1, 3, ModelPatch{})
	if !errors.Is(err, want) {
		t.Fatalf("error = %v, want wrapped storage error", err)
	}
}

type testStore struct {
	model       Model
	updates     int
	updateError error
}

func newTestStore() *testStore {
	return &testStore{
		model: Model{
			ID:          1,
			DisplayName: "weather",
			Enabled:     true,
			Status:      ModelStatusActive,
			Version:     3,
		},
	}
}

func (s *testStore) Get(context.Context, int64) (*Model, error) {
	snapshot := s.model
	return &snapshot, nil
}

func (s *testStore) Update(
	_ context.Context,
	_, expectedVersion int64,
	patch ModelPatch,
) (*Model, error) {
	s.updates++
	if s.updateError != nil {
		return nil, s.updateError
	}
	if s.model.Version != expectedVersion {
		return nil, ErrConflict
	}

	if patch.DisplayName != nil {
		s.model.DisplayName = *patch.DisplayName
	}
	if patch.Enabled != nil {
		s.model.Enabled = *patch.Enabled
	}
	s.model.Version++

	snapshot := s.model
	return &snapshot, nil
}
