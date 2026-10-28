package com.presales.pipeline.importing;
import java.util.*;
import java.util.function.Supplier;

/** Per-worker, bounded to one 100-item chunk; never shared across concurrent jobs. */
public final class ImportReferenceScope implements AutoCloseable {
    private static final ThreadLocal<ImportReferenceScope> ACTIVE=new ThreadLocal<>();
    private final Map<String,Object> snapshots=new HashMap<>();
    private String revision;
    private final ImportReferenceScope previous;
    private ImportReferenceScope(){previous=ACTIVE.get();ACTIVE.set(this);}
    public static ImportReferenceScope open(){return new ImportReferenceScope();}
    @SuppressWarnings("unchecked") public static <T>T cached(String key,Supplier<T> load){var scope=ACTIVE.get();if(scope==null)return load.get();return (T)scope.snapshots.computeIfAbsent(key,k->load.get());}
    public static void clear(){var scope=ACTIVE.get();if(scope!=null)scope.clearReferences();}
    public static void put(String key,Object value){var scope=ACTIVE.get();if(scope!=null)scope.snapshots.put(key,value);}
    @SuppressWarnings("unchecked") public static <T>T get(String key){var scope=ACTIVE.get();return scope==null?null:(T)scope.snapshots.get(key);}
    private void clearReferences(){Object batch=snapshots.get("batch-lookups");snapshots.clear();if(batch!=null)snapshots.put("batch-lookups",batch);}
    public static void revision(String revision){var scope=ACTIVE.get();if(scope!=null&&!Objects.equals(revision,scope.revision)){scope.clearReferences();scope.revision=revision;}}
    @Override public void close(){if(previous==null)ACTIVE.remove();else ACTIVE.set(previous);}
}
