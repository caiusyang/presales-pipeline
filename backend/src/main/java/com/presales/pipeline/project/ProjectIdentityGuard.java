package com.presales.pipeline.project;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantLock;
/** Single-instance name guard, held until transaction completion; external/HCS IDs also have database unique constraints. */
@Component
public class ProjectIdentityGuard {
    private final ConcurrentMap<String,ReentrantLock> locks=new ConcurrentHashMap<>();
    public void acquire(String customer,String project){
        if(!TransactionSynchronizationManager.isSynchronizationActive())throw new IllegalStateException("Project mutation requires a transaction");
        String key=String.valueOf(customer).trim().toLowerCase(Locale.ROOT)+"\u0000"+String.valueOf(project).trim().toLowerCase(Locale.ROOT);
        for(var sync:TransactionSynchronizationManager.getSynchronizations())if(sync instanceof Held held&&held.key.equals(key))return;
        var lock=locks.computeIfAbsent(key,ignored->new ReentrantLock());lock.lock();TransactionSynchronizationManager.registerSynchronization(new Held(key,lock));
    }
    private record Held(String key,ReentrantLock lock) implements TransactionSynchronization { @Override public void afterCompletion(int status){lock.unlock();} }
}
